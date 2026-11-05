# Distributed Job Management Platform

A full-stack job scheduling platform: register recurring health-check jobs in
PostgreSQL, have **Temporal** execute them on an interval, and manage everything
through a React UI with JWT-authenticated admin/viewer roles.

## Problem

Teams need a reliable way to register recurring checks against HTTP endpoints,
see whether they ran, and manage their lifecycle — without hand-rolling cron.
The interesting engineering problems here are the ones nobody sees:

- registering the same job twice, concurrently or via client retry
- keeping a durable Postgres record and an external Temporal schedule consistent
  across partial failures
- not holding database locks while doing DNS lookups or gRPC calls
- authenticating and rate-limiting without leaking user information

## Architecture

```
React (Vite) ──proxy /api──> Spring Boot API ──> PostgreSQL (source of truth)
                                 │
                                 ├─> Temporal server (schedules + executions)
                                 │      └─> worker: HealthCheckActivity
                                 │            └─> HTTP GET target_url
                                 └─> /actuator/health{liveness,readiness}
```

**Backend** (`src/`): Spring Boot 3.5 · Spring Security (JWT, HS256) · Spring
Data JPA · Flyway · Temporal Java SDK 1.30.
**Frontend** (`frontend/`): React 19 · TypeScript · TanStack Query · React Hook
Form + Zod · Tailwind/shadcn · Vitest + RTL + MSW.
**Infra**: Docker Compose — backend (`network_mode: host`), Temporal,
temporal-db, temporal-ui (all localhost-bound).

| Component | Version |
|---|---|
| Java | 21 |
| Spring Boot | 3.5.3 |
| Temporal SDK | 1.30.1 |
| PostgreSQL | 16 |
| Vite / React | 6.x / 19 |

## How it works

### Register (`POST /api/jobs` + `Idempotency-Key` header)

1. URL validated (scheme/credentials/hostname rules + public-IP DNS check) —
   *before* any transaction.
2. **TX1**: `INSERT … ON CONFLICT DO NOTHING` reserves the idempotency key → row
   lock → `pg_advisory_xact_lock(name, target_url)` identity lock → duplicate
   check → insert job as `PENDING` → commit.
3. Replay check: stored response → return it (idempotent retry).
4. **Striped sync** (JVM-local per-job lock, 64 stripes): create the Temporal
   schedule — the SDK's `AlreadyRunning` case converges via update.
5. **TX2**: snapshot the response onto the registration row → commit.

### Update (`PUT /api/jobs/{id}`)

Commit-then-sync: **TX1** locks the row + identity, checks uniqueness, mutates,
commits. Then the striped sync re-reads the *latest committed* job and pushes it
to Temporal — Temporal can never be ahead of Postgres. Sync failure marks the
job `FAILED` in a separate transaction; the response is still `200` with
`scheduleStatus: FAILED`.

### Retry (`POST /api/jobs/{id}/schedule`)

Converge, don't no-op: `SCHEDULED` → `updateSchedule` re-syncs Temporal to the
committed config (recovers from crashes and externally-deleted schedules);
`NOT_FOUND` → `FAILED`; `FAILED`/`PENDING` → create (upsert on `AlreadyRunning`).

### Delete (`DELETE /api/jobs/{id}`)

Temporal delete first; `NOT_FOUND` counts as done; any other failure aborts the
whole operation (no orphaned schedules). Row + idempotency rows deleted in one
tx — all inside the job's stripe.

### Executions

Execution history is read live from Temporal visibility
(`WorkflowId STARTS_WITH 'health-check-{id}'`) — no duplicated table. A fixed
`health-check-{jobId}` workflow ID means a slow check can't overlap with the
next tick.

## Security

- JWT (HS256, `sub`+`role`, 60-min TTL); `JWT_SECRET` is **required** at startup
  (≥32 bytes, no default).
- Roles: `ADMIN` (all mutations), `VIEWER` (reads + register/login). Backend
  enforces; frontend gates only for UX.
- Login: BCrypt, dummy-hash timing equalization, rate limiting — 5 failures per
  `user@ip` → 60s lockout → 429, with bounded expiring state.
- SSRF: two layers — `TargetUrlPolicy` at registration *and* the HTTP client's
  DNS resolver re-checks resolved IPs at connect time (defends rebinding).
- Headers: CSP, Referrer-Policy, X-Frame-Options, nosniff. CORS configurable.
- Ports: backend 8080, Temporal 7233, temporal-ui 8233, compose-postgres 5433 —
  all bound to `127.0.0.1`. Container runs as uid 1001.

## Health endpoints

- `GET /actuator/health` — `{"status":"UP","groups":[...]}` (anonymous, details hidden)
- `GET /actuator/health/liveness` — process alive
- `GET /actuator/health/readiness` — `readinessState` + `db` + `temporal`
  (the Docker healthcheck target; `getSystemInfo` RPC, 2s deadline)

## Setup

```bash
cp .env.example .env          # set a random JWT_SECRET
docker compose up -d --build  # backend: 127.0.0.1:8080, needs host Postgres on :5432
cd frontend && npm install && npm run dev   # :5173, proxies /api
```

Default admin: `admin` / `admin123` (`ADMIN_PASSWORD` overrides — a WARN logs
when the default is in effect). Register viewer accounts via the UI.

### Environment variables

| Var | Purpose |
|---|---|
| `JWT_SECRET` | **required**, ≥32 bytes |
| `ADMIN_PASSWORD` | seeded admin password (default `admin123`) |
| `DB_URL` / `DB_USER` / `DB_PASSWORD` | Postgres |
| `TEMPORAL_SERVICE_TARGET` / `TEMPORAL_NAMESPACE` / `TEMPORAL_TASK_QUEUE` | Temporal |
| `CORS_ALLOWED_ORIGINS` | comma-separated origins |
| `JWT_TTL_MINUTES` | token lifetime (default 60) |
| `TEST_DB_URL` | enables the integration suite (below) |

## Tests

```bash
mvn test                                # backend unit tests
cd frontend && npx vitest run           # frontend tests (Vitest + RTL + MSW)
npm run typecheck && npm run build      # types + production build
```

PostgreSQL integration tests (skipped unless `TEST_DB_URL` is set — they prove
advisory-lock concurrency and idempotency against a real database):

```bash
docker exec <pg-container> psql -U jobplatform -d postgres \
  -c "CREATE ROLE verification LOGIN PASSWORD 'verification';"
docker exec <pg-container> psql -U jobplatform -d postgres \
  -c "CREATE DATABASE verification OWNER verification;"
TEST_DB_URL="jdbc:postgresql://127.0.0.1:5433/verification" \
  mvn test -Dtest=JobRegistrationIntegrationTest
```

## Known limitations (intentional, documented)

- In-memory rate limiting and schedule sync stripes are **per-JVM** — multi-instance
  deployment needs distributed coordination (Redis/DB) — out of scope.
- Executions live only in Temporal visibility (retention-bounded); no local
  execution-history table.
- Crash between a committed update and its Temporal sync can leave Temporal
  briefly stale — the retry endpoint converges; a full periodic reconciliation
  sweep is deferred.
- Login lockout resets on restart; no token revocation (60-min TTL bounds it).
- `network_mode: host` is Linux-only; the bundled `postgres` service is for the
  integration tests — the app expects a host Postgres by default.

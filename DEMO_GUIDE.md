# Demo Guide — Distributed Job Scheduling Platform

Everything needed to start the system, demo it, and walk through the code.

> One-line framing for every explanation:
> **"We didn't just build a job scheduler — we designed for failure: retries, races, crashes."**

---

## Part 1 — Startup (3 terminals)

### Terminal 1 — Infrastructure (PostgreSQL + Temporal)

```bash
cd "/home/adminti/Desktop/Distributed Job Scheduling Platform"
docker compose up -d
docker compose ps    # confirm all containers are Up
```

### Terminal 2 — Backend

```bash
cd "/home/adminti/Desktop/Distributed Job Scheduling Platform"
mvn spring-boot:run
```

Wait for `Started JobPlatformApplication`. Verify:

```bash
curl http://127.0.0.1:8080/api/jobs?size=1
# Expected: {"content":[...], "totalElements":N, ...}  (a page object, NOT an array)
```

### Terminal 3 — Frontend

```bash
cd "/home/adminti/Desktop/Distributed Job Scheduling Platform/frontend"
export PATH="$HOME/tools/node/bin:$PATH"   # npm is not on PATH by default
npm run dev
```

Open **http://localhost:5173** (Vite may pick 5174 if 5173 is busy — check its output).

### Optional — Temporal UI

http://localhost:8233 — live schedules and workflow history.

> **Temporal UI filter caveat:** do NOT filter by `TemporalScheduledById` — that
> search attribute isn't registered in the dev server and returns 0 results.
> Use `WorkflowId STARTS_WITH "health-check-<job-id>"` or the unfiltered list.

### Pre-demo checklist (morning of)

```bash
docker compose ps                                                       # infra up?
curl -s http://127.0.0.1:8080/api/jobs?size=1 | head -c 80              # backend + paginated shape?
curl -s http://127.0.0.1:8080/api/jobs/dashboard | python3 -m json.tool | head -8
```

If port 8080 is busy: `ss -tlnp | grep 8080` → `kill <pid>` → restart.

Hard-refresh the browser (Ctrl+Shift+R) before demoing.

---

## Part 2 — The 60-Second Pitch

Don't start with Spring Boot, Temporal, PostgreSQL or React. Start with the problem.

> "We built a **Distributed Job Management Platform** to solve a common problem.
> Teams have recurring tasks — health checks, reports, background jobs — usually
> configured separately across servers, making them hard to monitor and manage.
>
> Our platform brings everything into one place. Users register jobs through a UI,
> configure how often they run, and Temporal executes them durably. PostgreSQL stores
> the job data and the dashboard shows status and execution history.
>
> But our main focus wasn't just scheduling — it was making the system behave
> correctly under real-world conditions: repeated requests, failures, restarts,
> and concurrent traffic without creating duplicate jobs.
>
> In simple terms: **register jobs, execute them reliably, monitor everything in one place.**"

### Architecture (draw this, don't just say it)

```
React + TypeScript UI        — user registers and monitors jobs
        |
Spring Boot REST API         — validates, business logic, coordinates
        |
   +----+--------------------+
   |                         |
PostgreSQL              Temporal
job data +              durable schedules
idempotency keys             |
                        Temporal Worker
                             |
                        Health Check Activity
                        (calls the target URL)
```

> "Each component has a clear responsibility instead of everything living in one layer."

---

## Part 3 — Demo Script (~5 min)

| Step | Do | Say |
|---|---|---|
| 1. Dashboard | Show cards + feed | "Overview of jobs, schedule health, and a live count of failed executions in the last 24h — queried straight from Temporal. Counts come from database aggregate queries, not loading the whole table." |
| 2. Register | Name `demo-check`, URL `https://www.github.com`, interval `30` | "Name, target URL, interval — the job is scheduled the moment we register." |
| 3. Double-click | Click Register 3–4 times fast | "Only ONE job was created. The UI sends an `Idempotency-Key`; the backend replays the original result for retries. Disabling the button is UX — correctness lives in the database." |
| 4. Duplicate | Register same name + URL again | "409 'already exists' — enforced by a DB unique constraint, so no race can bypass it." |
| 5. SSRF | Try `http://localhost:8080/api/jobs` | "Rejected — 'must resolve only to public internet addresses'. We block localhost/private IPs and don't follow redirects. That's SSRF protection." |
| 6. Temporal UI | Schedules → `job-<id>`; Workflows → `health-check-<id>-...` | "Every interval Temporal durably starts a workflow. Crash mid-run? Temporal retries. That's why Temporal over cron: durability, distribution, history." |
| 7. Jobs list | Search / sort | "Server-side pagination, filtering, sorting — the UI fetches 10 rows, never the whole table. Indexes verified with EXPLAIN on 10k rows." |
| 8. Limitations | Say unprompted | "Known gaps: no auth, no edit endpoint, DB↔Temporal isn't atomic — reconciled via statuses. Verified for these flows, not production-certified." |

---

## Part 4 — Code Walkthrough Script

Opening line:

> "Let me walk through the code the way a request flows — API, business logic, Temporal, and back."

### `controller/JobController.java`

> "API layer only: validate, call service, map to HTTP. No business logic here — deliberate.
> Two things: the `Idempotency-Key` header (the client's retry identity), and
> `GET /api/jobs` takes page/size/search/status/sort — all pushed to the database."

**If asked why the controller needs the key:** "It belongs to the request, not the job. Same key = same attempt."

### `service/JobService.java` → `register()` — THE centerpiece

> "Registration is three phases because PostgreSQL and Temporal can't share a
> transaction — a rollback can't un-create a Temporal schedule.
>
> **Phase 1** — reserve the idempotency key: `INSERT ... ON CONFLICT DO NOTHING`.
> Two same-key requests at the same millisecond → one wins, the loser waits on a
> row lock, then replays the winner's stored response. The race is resolved by
> the database, not timing luck.
>
> **Phase 2** — create the job as `PENDING` and commit.
>
> **Phase 3** — call Temporal *outside* the transaction so a slow Temporal call
> doesn't hold DB locks. Success → `SCHEDULED`; failure → `FAILED`, recoverable
> via the schedule endpoint.
>
> The accepted trade-off: between phase 2 and 3 the job exists unscheduled.
> That's recoverable state, not corruption."

**If asked "crash between 2 and 3?":** "Job stays FAILED/PENDING — visible on the dashboard, recoverable via the schedule endpoint, which is protected against concurrent callers."

### `service/JobSchedulingService.java`

> "The Temporal boundary. Schedule ID is deterministic — `job-<job-id>` — so a
> retry gets 'already exists' instead of a duplicate. Idempotency at the external
> system too. Disabled jobs get a *paused* schedule — reversible, unlike deletion."

### `service/TargetUrlPolicy.java`

> "Security control, not convenience. A scheduler that fetches arbitrary URLs is
> an SSRF hole — think `169.254.169.254` or internal services. We require
> http/https, reject local hostnames, resolve DNS, and reject private/loopback/
> link-local addresses. Redirects are disabled in the activity, or a public URL
> could redirect to a private one and bypass this."

### `activity/HealthCheckActivityImpl.java`

> "The unit Temporal executes. It re-validates the target — policy may have
> changed since registration. Failure classification matters: disallowed target
> = non-retryable (retry can't fix policy); timeout/DNS = retryable; HTTP 500 =
> a result, not an exception. Temporal retries only where retrying makes sense."

### `entity/Job.java` → `@Version`

> "Optimistic locking. Two transactions load and save → the second is rejected,
> not silently overwritten. Currently dormant — no edit endpoint yet — but wired
> and tested, so concurrent-update protection comes free when editing lands."

**Don't claim it protects something that doesn't exist.**

### `repository/`

> "`findByKeyForUpdate` — pessimistic write lock for the idempotency race.
> `lockRegistration` — serializes same-name-URL registrations.
> `JpaSpecificationExecutor` — powers search/filter queries."

### `db/migration/` V1–V6

> "Flyway — every schema change is versioned, reviewable SQL. V2/V4 add indexes
> for listing and duplicate lookups. V6 enforces name+URL uniqueness — added only
> AFTER cleaning existing duplicates, because you can't constrain dirty data.
> `ddl-auto` can't express that ordering."

### `frontend/src/pages/RegisterJobPage.tsx`

> "The frontend half of idempotency: one UUID per submission, held in a ref.
> Retries reuse it; it regenerates only after success or a deliberate change.
> Double-clicks, network drops, error retries — all replay safely.
> The disabled button is UX polish, not correctness."

### `frontend/src/lib/api.ts` + `hooks/useJobs.ts`

> "The client preserves `Content-Type: application/json` when merging headers —
> a real bug we hit. React Query handles caching/refresh; on failure we keep the
> last good data plus a 'connection lost' warning, not a raw error."

### Closing line

> "Same pattern everywhere: every request is safe to retry, every race is resolved
> by the database, every external call is recoverable. That's 'designed for failure'
> in code."

---

## Part 5 — Rapid-Fire Answers

| Question | One-liner |
|---|---|
| Why Temporal over cron/@Scheduled? | Durability (survives restarts), distribution (any worker runs it), history (every run recorded). |
| Why `@Transactional` not around whole register? | A rollback can't undo a Temporal API call. Commit first, schedule second, reconcile via status. |
| Why pessimistic lock on the key row? | Two same-key requests must serialize — optimistic checks would let both pass 'not found'. |
| Why idempotency key AND unique constraint? | Key replays the *same* request; constraint catches *different* requests that collide. Different problems. |
| Why deterministic schedule IDs? | Temporal dedupes for us — retry hits 'already exists', we adopt it. |
| Why store keys in DB, not memory? | Survives restarts and works across multiple app instances. |
| Why optimistic AND pessimistic? | Optimistic for edits (conflicts rare, no locks held); pessimistic for must-serialize ops (recovery, key claims). |
| Why PostgreSQL? | ACID, row locks, `ON CONFLICT` — the idempotency design depends on them. |
| Why Flyway over `ddl-auto`? | No silent schema changes; explicit, reviewable, can sequence 'clean data → add constraint'. |
| Why DTOs? | API contract stays stable when internal schema changes; no lazy-loading leaks. |
| Why server-side pagination? | 10,000 jobs → fetch 10. Filter/sort/index in the DB. |
| Why page-size cap? | Stops `?size=1000000` from hurting the DB. |
| Why SSRF validation? | Otherwise the server becomes an attack proxy into internal networks. |
| Why indexes? | Verified with EXPLAIN — index scans for listing + duplicate lookup at 10k rows. |
| What if Temporal is down? | Job saves as FAILED; schedule endpoint recovers it. Dashboard count shows `—`, not fake 0. |
| What if backend is down? | UI shows 'cannot connect' + keeps cached data with a stale warning. |
| Why React Query? | Caching, loading states, background refetch for free. |
| Why Zod? | Validates API responses at the boundary — catches contract drift. |
| Why recharts not Highcharts? | Highcharts needs a paid license for commercial use; recharts is MIT. |
| What's NOT implemented? | Auth, job editing (entity `@Version` is ready), full DB↔Temporal reconciliation. |

---

## Part 6 — Memory Sheet (revise this last)

| # | Point |
|---|---|
| 1 | **Problem:** recurring jobs are scattered and unmonitored |
| 2 | **Solution:** one platform to register, schedule, monitor |
| 3 | **Architecture:** React → Spring Boot → PostgreSQL + Temporal → Worker |
| 4 | **Reliability:** idempotency keys, locking, 3-phase register, recovery |
| 5 | **Scalability:** server-side pagination, indexes, aggregate queries |
| 6 | **Security:** SSRF validation, input validation, local-only binding |
| 7 | **Maintainability:** layered packages, DTOs, Flyway |

The one message connecting everything:

> **"I considered what happens when two identical requests arrive at the same
> moment, and designed the database flow to prevent duplicates even then."**
>
> That — not a list of technologies — is what makes it engineering.

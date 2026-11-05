# Testing & Demo Guide

Manual end-to-end walkthrough for the Distributed Job Management Platform.
Covers starting everything, testing each feature, verifying data in Postgres
and Temporal, and a demo script for showing the project to someone new.

---

## 1. Start the stack

### 1.1 Infrastructure (Postgres + Temporal + Temporal UI)

```bash
docker compose up -d
docker ps   # expect: temporal-1, temporal-ui-1, temporal-db-1 (postgres-1 optional)
```

> Note: if a local PostgreSQL already runs on 5432, the compose `postgres`
> service will fail to bind — that's fine, the app uses the local one.

Verify:

| Service      | Check                                    | Expected |
|--------------|------------------------------------------|----------|
| Temporal     | `ss -tln \| grep 7233`                   | LISTEN   |
| Temporal UI  | `ss -tln \| grep 8233`                   | LISTEN   |
| Postgres     | `pg_isready -h localhost -p 5432`        | accepting connections |

### 1.2 Backend (Spring Boot, port 8080)

```bash
# Option A: packaged jar
java -jar target/job-platform-0.0.1-SNAPSHOT.jar

# Option B: from source
mvn spring-boot:run
```

Verify: `curl http://localhost:8080/api/jobs` → `200` with a JSON array.

### 1.3 Frontend (Vite dev server, port 5173)

```bash
export PATH="$HOME/tools/node/bin:$PATH"   # local Node install
cd frontend
npm install   # first time only
npm run dev
```

Open http://localhost:5173 — the dashboard should show real job data.

> The dev server proxies `/api/*` → `http://localhost:8080`. If the backend
> is down the app shows a clean "Backend unreachable" state (proxy returns
> a JSON 502).

### Useful logs

- Backend log (jar): `/tmp/jobplatform.log` — health-check results are logged per run
- Temporal container: `docker logs -f distributedjobschedulingplatform-temporal-1`

---

## 2. Feature testing checklist

### 2.1 Dashboard (`/`)

- [ ] Stat cards show correct totals (total / scheduled / pending / failed)
- [ ] Status donut matches the numbers
- [ ] "Needs attention" lists jobs whose scheduleStatus is FAILED
- [ ] "Execution feed" shows live workflow runs (green dot = completed, pulsing red = failed) — updates ~every 15s
- [ ] "Recent activity" lists jobs by last update

### 2.2 Jobs table (`/jobs`)

- [ ] Search filters by name AND target URL
- [ ] Status filter: All / Scheduled / Pending / Failed
- [ ] State filter: Enabled / Disabled
- [ ] Column headers sort (name, interval, status, created)
- [ ] Pagination appears when >10 rows match
- [ ] Click a row → navigates to job detail
- [ ] Empty state shows when nothing matches

### 2.3 Registration (`/jobs/new`)

- [ ] Interval `5` → inline error "at least 10 seconds" (mirrors backend `@Min(10)`)
- [ ] Bad URL (`not-a-url`) → inline URL error
- [ ] Empty name → required error
- [ ] Valid submit → success panel → "View job" → detail page
- [ ] Server-side validation also maps onto fields (try to bypass client validation)

### 2.4 Job detail (`/jobs/{id}`)

- [ ] Config + scheduling sections populated
- [ ] Temporal schedule ID: copy button works, link icon opens the schedule in Temporal UI
- [ ] "Recent executions" lists real workflow runs with status + duration + "x s ago"; each row links to the workflow in Temporal UI
- [ ] PENDING/FAILED jobs show "Retry schedule" → confirmation dialog → status flips to SCHEDULED
- [ ] Fake ID in URL → "Job not found" empty state

### 2.5 Failure / recovery

- [ ] `unreachable` job shows `failed` executions (retried 3× with backoff per run)
- [ ] Stop Temporal: `docker stop distributedjobschedulingplatform-temporal-1`
  → register a job → saves with `scheduleStatus = FAILED`
  → restart: `docker start distributedjobschedulingplatform-temporal-1`
  → job detail → **Retry schedule** → becomes `SCHEDULED`
- [ ] Confirmation dialog prevents accidental double-submit (button disabled while working)

### 2.6 Resilience

- [ ] Kill the backend while browsing → UI shows "Backend unreachable" error state with Retry (no crash)
- [ ] Restart backend → dashboard recovers automatically on next poll

---

## 3. Verifying data in Postgres

```bash
# All jobs
PGPASSWORD=jobplatform psql -h localhost -U jobplatform -d jobplatform \
  -c "SELECT name, job_type, interval_seconds, enabled, schedule_status, temporal_schedule_id FROM jobs ORDER BY created_at;"

# Idempotent registrations (populated only when Idempotency-Key path is used)
PGPASSWORD=jobplatform psql -h localhost -U jobplatform -d jobplatform \
  -c "SELECT idempotency_key, job_id, created_at FROM job_registrations;"
```

Postgres stores **job definitions only** — execution history lives in Temporal.

## 4. Verifying data in Temporal

### Temporal UI (recommended for demos)

http://localhost:8233 → namespace `default`:

- **Schedules** — one `job-{uuid}` per scheduled job; `Paused` if the job is disabled
- **Workflows** — one `health-check-{uuid}-{timestamp}` run per execution; click for full event history (activity attempts, retries, results)

### CLI (inside the container)

```bash
IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
     distributedjobschedulingplatform-temporal-1)

# Schedules
docker exec distributedjobschedulingplatform-temporal-1 \
  temporal schedule list --address $IP:7233 --namespace default

# Recent workflow runs
docker exec distributedjobschedulingplatform-temporal-1 \
  temporal workflow list --address $IP:7233 --namespace default --limit 15

# Runs for one job (prefix query)
docker exec distributedjobschedulingplatform-temporal-1 \
  temporal workflow list --address $IP:7233 --namespace default \
  --query 'WorkflowId STARTS_WITH "health-check-<JOB_UUID>"'
```

---

## 5. API smoke test (curl)

```bash
BASE=http://localhost:8080

# List jobs
curl -s $BASE/api/jobs | python3 -m json.tool

# Register a job
curl -s -X POST $BASE/api/jobs -H 'Content-Type: application/json' -d '{
  "name": "manual-check",
  "jobType": "HEALTH_CHECK",
  "targetUrl": "http://localhost:8080/api/jobs",
  "intervalSeconds": 30,
  "enabled": true
}' | python3 -m json.tool          # expect 201 + SCHEDULED + temporalScheduleId

# Validation error (interval < 10)
curl -s -X POST $BASE/api/jobs -H 'Content-Type: application/json' -d '{
  "name": "x", "jobType": "HEALTH_CHECK",
  "targetUrl": "http://localhost:8080", "intervalSeconds": 5
}'                                 # expect 400 {"error":"validation failed","fields":{...}}

# Job detail + executions
curl -s $BASE/api/jobs/<JOB_UUID> | python3 -m json.tool
curl -s $BASE/api/jobs/<JOB_UUID>/executions | python3 -m json.tool

# Retry schedule creation (recovery)
curl -s -X POST $BASE/api/jobs/<JOB_UUID>/schedule | python3 -m json.tool

# 404
curl -s $BASE/api/jobs/00000000-0000-0000-0000-000000000000
```

---

## 6. Demo script (~10 min)

1. **Pitch**: "Users register scheduled health-check jobs. Spring Boot stores
   definitions in Postgres; Temporal runs them on intervals with retries.
   The React dashboard talks to the API."
2. **Register**: `/jobs/new` — show a validation error first (`interval=5`),
   then submit a valid job → success → **View job**.
3. **Detail page**: SCHEDULED status, Temporal schedule ID, live
   **Recent executions** ticking in.
4. **Prove persistence**: run the Postgres `SELECT` (section 3) — the new
   row is there.
5. **Prove execution**: click the Temporal-UI link on the schedule ID →
   show schedule + workflow event history.
6. **Failure story**: open `unreachable` — failed executions + pulsing dot
   on the dashboard feed. Explain retry policy (3 attempts, backoff).
7. **Recovery story**: stop Temporal → register job → FAILED → restart
   Temporal → **Retry schedule** → SCHEDULED.
8. **Close on dashboard**: stats, donut, live execution feed.
9. **Party trick** (optional): kill backend mid-demo → graceful error state;
   restart → dashboard self-recovers.

Architecture one-liner:
**React UI → REST API (Spring Boot) → Postgres (definitions) + Temporal (schedules, workflows, retries).**

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| UI shows "Backend unreachable" | Spring Boot not running | `java -jar target/...jar` |
| All new jobs `scheduleStatus=FAILED` | Temporal container down | `docker start distributedjobschedulingplatform-temporal-1` |
| Executions card empty | No runs yet / Temporal just restarted | Wait one interval tick |
| Compose postgres fails to bind 5432 | Local Postgres already running | Harmless — app uses local DB |
| `temporal` CLI connection refused | Server binds container IP | Use `--address <container-ip>:7233` (see §4) |
| `npm` not found | Node not on PATH | `export PATH="$HOME/tools/node/bin:$PATH"` |

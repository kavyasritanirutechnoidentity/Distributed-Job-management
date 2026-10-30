# Job Platform — Frontend

Operations dashboard for the Distributed Job Management Platform backend.

## Stack

React 18 + TypeScript (strict), Vite, TanStack Query, React Router, React Hook
Form + Zod, Tailwind CSS, Recharts, Framer Motion, Lucide icons.

## Run

```bash
npm install
npm run dev   # http://localhost:5173, proxies /api → http://localhost:8080
```

The backend must be running (`./mvnw spring-boot:run` from the repo root).
When it isn't, the UI shows a clear "backend unreachable" state — the dev
proxy converts connection failures into a JSON 502.

## Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm run typecheck` — strict TS check only

## API surface used

| Endpoint | Used for |
|---|---|
| `GET /api/jobs` | Dashboard + jobs table (polled every 15s) |
| `GET /api/jobs/{id}` | Job detail page |
| `POST /api/jobs` | Registration form; sends a stable `Idempotency-Key` per submission attempt set |
| `POST /api/jobs/{id}/schedule` | Recovery action for PENDING/FAILED schedules |

Honesty notes: the backend does not expose per-run execution results, so the
dashboard shows **schedule** status (Temporal schedule creation), never fake
execution success/failure data. There are no update/delete endpoints, so no
edit or delete UI exists.

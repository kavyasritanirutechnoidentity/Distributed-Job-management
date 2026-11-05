# Verification

- Run backend tests from the repository root with `mvn test` (Java 21).
- Run frontend verification from `frontend` with `npm run build` or `npm run typecheck`.
- In this environment Node is available at `$HOME/tools/node/bin`; prepend that directory to PATH if needed.
- Backend migrations use Flyway and PostgreSQL-specific SQL. Unit tests mock repositories and do not verify native queries or migrations against PostgreSQL.
- `GET /api/jobs` returns a page object, not an array. Keep frontend schemas and API consumers aligned when changing this contract.

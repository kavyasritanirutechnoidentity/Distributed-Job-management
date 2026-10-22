# Distributed Job Management Platform

A learning MVP built with Spring Boot, PostgreSQL, and Temporal.

The first use case is a **scheduled health check**: register a job that polls a
target URL on a schedule, executes the check via a Temporal workflow/activity,
and records the result.

## Architecture

- **Spring Boot API** — REST endpoints, request validation, business rules.
- **PostgreSQL** — stores job definitions only (not Temporal execution history).
- **Temporal** — schedules and runs workflows, applies retry policies.
- **Worker** — executes the health-check activity. Runs in the same process as
  the API for the MVP, but uses the Temporal worker model so it can be split
  out later.

## Tech stack and versions

| Component     | Version | Why |
|---------------|---------|-----|
| Java          | 21      | Current LTS |
| Spring Boot   | 3.5.3   | Stable 3.5.x line |
| Temporal SDK  | 1.30.1  | Latest stable Java SDK |
| PostgreSQL    | 16      | Stable, widely used |
| Flyway        | (managed by Spring Boot) | Explicit, versioned schema migrations |

## Project layout

```
com.example.jobplatform
├── controller   REST controllers
├── service      application/business logic
├── repository   Spring Data JPA repositories
├── entity       JPA entities
├── dto          request/response objects
├── workflow     Temporal workflow definitions
├── activity     Temporal activity interfaces + implementations
├── config       application & Temporal configuration
└── exception    exceptions and error handling
```

## Running locally

Prerequisites: JDK 21, Maven 3.9+, Docker.

```bash
# Start PostgreSQL and Temporal (+ UI on http://localhost:8233)
docker compose up -d

# Run the app
./mvnw spring-boot:run
```

## API (planned)

- `POST /api/jobs` — register a job
- `GET /api/jobs` — list jobs
- `GET /api/jobs/{id}` — get one job definition

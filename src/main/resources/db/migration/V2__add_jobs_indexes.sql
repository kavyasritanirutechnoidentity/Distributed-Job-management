-- One temporal schedule belongs to at most one job; lookups by schedule id
-- (e.g. reconciling a schedule back to its job) use this index.
-- Postgres unique indexes allow multiple NULLs, so jobs still pending a
-- schedule are unaffected.
CREATE UNIQUE INDEX idx_jobs_temporal_schedule_id
    ON jobs (temporal_schedule_id);

-- Supports "find jobs by schedule status" queries, e.g. retry sweeps for
-- FAILED jobs and status filtering in the job list.
CREATE INDEX idx_jobs_schedule_status
    ON jobs (schedule_status);

-- Supports ordering job listings by most recently created without a sort step.
CREATE INDEX idx_jobs_created_at
    ON jobs (created_at DESC);

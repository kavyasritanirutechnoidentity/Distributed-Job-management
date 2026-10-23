CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    job_type VARCHAR(255) NOT NULL,
    target_url VARCHAR(2048) NOT NULL,
    interval_seconds BIGINT NOT NULL,
    enabled BOOLEAN NOT NULL,
    temporal_schedule_id VARCHAR(255),
    schedule_status VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

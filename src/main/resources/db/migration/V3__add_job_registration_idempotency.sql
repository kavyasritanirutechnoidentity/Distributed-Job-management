CREATE TABLE job_registrations (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    request_payload TEXT NOT NULL,
    job_id UUID UNIQUE REFERENCES jobs (id),
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

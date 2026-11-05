CREATE INDEX idx_jobs_name_target_lookup ON jobs (name, md5(target_url));
CREATE INDEX idx_jobs_created_id ON jobs (created_at DESC, id);
CREATE INDEX idx_jobs_updated_id ON jobs (updated_at DESC, id);
CREATE INDEX idx_jobs_status_updated_id ON jobs (schedule_status, updated_at DESC, id);
CREATE INDEX idx_jobs_enabled_created_id ON jobs (enabled, created_at DESC, id);

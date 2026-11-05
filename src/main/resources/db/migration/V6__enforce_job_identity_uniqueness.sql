CREATE UNIQUE INDEX idx_jobs_name_target_unique ON jobs (name, md5(target_url));

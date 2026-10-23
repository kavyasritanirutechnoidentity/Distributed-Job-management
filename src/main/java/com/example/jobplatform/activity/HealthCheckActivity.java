package com.example.jobplatform.activity;

import io.temporal.activity.ActivityInterface;

@ActivityInterface
public interface HealthCheckActivity {

    HealthCheckResult check(String targetUrl);
}

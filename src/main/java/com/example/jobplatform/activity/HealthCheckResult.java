package com.example.jobplatform.activity;

public record HealthCheckResult(
        int statusCode,
        boolean healthy,
        String detail
) {
}

package com.example.jobplatform.workflow;

import com.example.jobplatform.activity.HealthCheckActivity;
import com.example.jobplatform.activity.HealthCheckResult;
import io.temporal.activity.ActivityOptions;
import io.temporal.common.RetryOptions;
import io.temporal.failure.ApplicationFailure;
import io.temporal.workflow.Workflow;

import java.time.Duration;

public class JobExecutionWorkflowImpl implements JobExecutionWorkflow {

    private final HealthCheckActivity healthCheck = Workflow.newActivityStub(
            HealthCheckActivity.class,
            ActivityOptions.newBuilder()
                    .setStartToCloseTimeout(Duration.ofSeconds(30))
                    .setScheduleToCloseTimeout(Duration.ofMinutes(2))
                    .setRetryOptions(RetryOptions.newBuilder()
                            .setInitialInterval(Duration.ofSeconds(1))
                            .setBackoffCoefficient(2.0)
                            .setMaximumAttempts(3)
                            .build())
                    .build());

    @Override
    public String execute(JobExecutionRequest request) {
        HealthCheckResult result = healthCheck.check(request.targetUrl());
        if (!result.healthy()) {
            throw ApplicationFailure.newFailure(
                    "health check failed for " + request.targetUrl() + ": " + result.detail(),
                    "HealthCheckFailed",
                    request.jobId().toString());
        }
        return "healthy: " + result.detail();
    }
}

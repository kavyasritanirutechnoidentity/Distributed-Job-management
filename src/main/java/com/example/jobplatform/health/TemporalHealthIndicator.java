package com.example.jobplatform.health;

import io.temporal.api.workflowservice.v1.GetSystemInfoRequest;
import io.temporal.serviceclient.WorkflowServiceStubs;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component("temporal")
public class TemporalHealthIndicator implements HealthIndicator {

    private static final long PROBE_TIMEOUT_SECONDS = 2;

    private final WorkflowServiceStubs serviceStubs;

    public TemporalHealthIndicator(WorkflowServiceStubs serviceStubs) {
        this.serviceStubs = serviceStubs;
    }

    @Override
    public Health health() {
        try {
            serviceStubs.blockingStub()
                    .withDeadlineAfter(PROBE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                    .getSystemInfo(GetSystemInfoRequest.getDefaultInstance());
            return Health.up().build();
        } catch (Exception e) {
            return Health.down().build();
        }
    }
}

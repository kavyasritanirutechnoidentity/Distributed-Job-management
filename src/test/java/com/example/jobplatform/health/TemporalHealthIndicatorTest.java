package com.example.jobplatform.health;

import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.temporal.api.workflowservice.v1.GetSystemInfoResponse;
import io.temporal.api.workflowservice.v1.WorkflowServiceGrpc;
import io.temporal.serviceclient.WorkflowServiceStubs;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TemporalHealthIndicatorTest {

    private final WorkflowServiceStubs stubs = mock(WorkflowServiceStubs.class);
    private final WorkflowServiceGrpc.WorkflowServiceBlockingStub blocking =
            mock(WorkflowServiceGrpc.WorkflowServiceBlockingStub.class);
    private final TemporalHealthIndicator indicator = new TemporalHealthIndicator(stubs);

    @BeforeEach
    void wireStub() {
        when(stubs.blockingStub()).thenReturn(blocking);
        when(blocking.withDeadlineAfter(anyLong(), any())).thenReturn(blocking);
    }

    @Test
    void upWhenSystemInfoResponds() {
        when(blocking.getSystemInfo(any())).thenReturn(GetSystemInfoResponse.getDefaultInstance());
        assertEquals(org.springframework.boot.actuate.health.Status.UP, indicator.health().getStatus());
    }

    @Test
    void downWhenTemporalUnreachable() {
        when(blocking.getSystemInfo(any())).thenThrow(new StatusRuntimeException(Status.UNAVAILABLE));
        assertEquals(org.springframework.boot.actuate.health.Status.DOWN, indicator.health().getStatus());
    }

    @Test
    void downWhenHealthCheckTimesOut() {
        when(blocking.getSystemInfo(any()))
                .thenThrow(new StatusRuntimeException(Status.DEADLINE_EXCEEDED));
        assertEquals(org.springframework.boot.actuate.health.Status.DOWN, indicator.health().getStatus());
    }
}

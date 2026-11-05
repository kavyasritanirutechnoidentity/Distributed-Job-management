package com.example.jobplatform.dto;

import java.time.Instant;

public record JobExecutionResponse(
        String workflowId,
        String status,
        Instant startTime,
        Instant closeTime,
        Long durationMs
) {
}

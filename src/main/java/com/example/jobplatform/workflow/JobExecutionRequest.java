package com.example.jobplatform.workflow;

import java.util.UUID;

public record JobExecutionRequest(
        UUID jobId,
        String targetUrl
) {
}

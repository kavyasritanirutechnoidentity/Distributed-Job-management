package com.example.jobplatform.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "temporal")
public record TemporalProperties(
        String serviceTarget,
        String namespace,
        String taskQueue
) {
}

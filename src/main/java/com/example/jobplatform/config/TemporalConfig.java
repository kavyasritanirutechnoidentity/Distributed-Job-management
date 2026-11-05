package com.example.jobplatform.config;

import io.temporal.client.WorkflowClient;
import io.temporal.client.WorkflowClientOptions;
import io.temporal.client.schedules.ScheduleClient;
import io.temporal.client.schedules.ScheduleClientOptions;
import io.temporal.serviceclient.WorkflowServiceStubs;
import io.temporal.serviceclient.WorkflowServiceStubsOptions;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(TemporalProperties.class)
public class TemporalConfig {

    @Bean
    public WorkflowServiceStubs workflowServiceStubs(TemporalProperties properties) {
        return WorkflowServiceStubs.newServiceStubs(
                WorkflowServiceStubsOptions.newBuilder()
                        .setTarget(properties.serviceTarget())
                        .setRpcTimeout(java.time.Duration.ofSeconds(5))
                        .setRpcRetryOptions(io.temporal.serviceclient.RpcRetryOptions.newBuilder()
                                .setMaximumAttempts(2).build())
                        .build());
    }

    @Bean
    public WorkflowClient workflowClient(WorkflowServiceStubs serviceStubs,
                                         TemporalProperties properties) {
        return WorkflowClient.newInstance(
                serviceStubs,
                WorkflowClientOptions.newBuilder()
                        .setNamespace(properties.namespace())
                        .build());
    }

    @Bean
    public ScheduleClient scheduleClient(WorkflowServiceStubs serviceStubs,
                                         TemporalProperties properties) {
        return ScheduleClient.newInstance(
                serviceStubs,
                ScheduleClientOptions.newBuilder()
                        .setNamespace(properties.namespace())
                        .build());
    }
}

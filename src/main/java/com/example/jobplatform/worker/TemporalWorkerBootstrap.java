package com.example.jobplatform.worker;

import com.example.jobplatform.activity.HealthCheckActivity;
import com.example.jobplatform.config.TemporalProperties;
import com.example.jobplatform.workflow.JobExecutionWorkflowImpl;
import io.temporal.client.WorkflowClient;
import io.temporal.worker.Worker;
import io.temporal.worker.WorkerFactory;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class TemporalWorkerBootstrap {

    private static final Logger log = LoggerFactory.getLogger(TemporalWorkerBootstrap.class);

    private final WorkerFactory workerFactory;

    public TemporalWorkerBootstrap(WorkflowClient workflowClient,
                                   TemporalProperties properties,
                                   HealthCheckActivity healthCheckActivity) {
        this.workerFactory = WorkerFactory.newInstance(workflowClient);
        Worker worker = workerFactory.newWorker(properties.taskQueue());
        worker.registerWorkflowImplementationTypes(JobExecutionWorkflowImpl.class);
        worker.registerActivitiesImplementations(healthCheckActivity);
    }

    @PostConstruct
    public void start() {
        workerFactory.start();
        log.info("Temporal worker started");
    }

    @PreDestroy
    public void shutdown() {
        workerFactory.shutdown();
    }
}

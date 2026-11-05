package com.example.jobplatform.service;

import com.example.jobplatform.config.TemporalProperties;
import com.example.jobplatform.entity.Job;
import com.example.jobplatform.workflow.JobExecutionRequest;
import com.example.jobplatform.workflow.JobExecutionWorkflow;
import io.temporal.client.WorkflowOptions;
import io.temporal.client.schedules.Schedule;
import io.temporal.client.schedules.ScheduleActionStartWorkflow;
import io.temporal.client.schedules.ScheduleAlreadyRunningException;
import io.temporal.client.schedules.ScheduleClient;
import io.temporal.client.schedules.ScheduleIntervalSpec;
import io.temporal.client.schedules.ScheduleSpec;
import io.temporal.client.schedules.ScheduleState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

@Service
public class JobSchedulingService {

    private static final Logger log = LoggerFactory.getLogger(JobSchedulingService.class);

    private final ScheduleClient scheduleClient;
    private final TemporalProperties properties;

    public JobSchedulingService(ScheduleClient scheduleClient, TemporalProperties properties) {
        this.scheduleClient = scheduleClient;
        this.properties = properties;
    }

    public String scheduleIdFor(Job job) {
        return "job-" + job.getId();
    }

    public String createSchedule(Job job) {
        String scheduleId = scheduleIdFor(job);
        try {
            scheduleClient.createSchedule(scheduleId, buildSchedule(job),
                    io.temporal.client.schedules.ScheduleOptions.newBuilder().build());
            log.info("Created temporal schedule {} for job {}", scheduleId, job.getId());
        } catch (ScheduleAlreadyRunningException e) {
            log.info("Schedule {} already exists, reusing it", scheduleId);
        }
        return scheduleId;
    }

    public void updateSchedule(Job job) {
        scheduleClient.getHandle(scheduleIdFor(job))
                .update(input -> new io.temporal.client.schedules.ScheduleUpdate(buildSchedule(job)));
        log.info("Updated temporal schedule {} for job {}", scheduleIdFor(job), job.getId());
    }

    public void deleteSchedule(String scheduleId) {
        scheduleClient.getHandle(scheduleId).delete();
        log.info("Deleted temporal schedule {}", scheduleId);
    }

    private Schedule buildSchedule(Job job) {
        return Schedule.newBuilder()
                .setAction(ScheduleActionStartWorkflow.newBuilder()
                        .setWorkflowType(JobExecutionWorkflow.class)
                        .setArguments(new JobExecutionRequest(job.getId(), job.getTargetUrl()))
                        .setOptions(WorkflowOptions.newBuilder()
                                .setWorkflowId("health-check-" + job.getId())
                                .setTaskQueue(properties.taskQueue())
                                .build())
                        .build())
                .setSpec(ScheduleSpec.newBuilder()
                        .setIntervals(List.of(new ScheduleIntervalSpec(
                                Duration.ofSeconds(job.getIntervalSeconds()))))
                        .build())
                .setState(ScheduleState.newBuilder()
                        .setPaused(!job.isEnabled())
                        .setNote(job.isEnabled() ? "" : "job registered as disabled")
                        .build())
                .build();
    }
}

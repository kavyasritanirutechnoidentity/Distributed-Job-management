package com.example.jobplatform.dto;

import com.example.jobplatform.entity.Job;
import com.example.jobplatform.entity.JobType;
import com.example.jobplatform.entity.ScheduleStatus;

import java.time.Instant;
import java.util.UUID;

public record JobResponse(
        UUID id,
        String name,
        JobType jobType,
        String targetUrl,
        long intervalSeconds,
        boolean enabled,
        String temporalScheduleId,
        ScheduleStatus scheduleStatus,
        Instant createdAt,
        Instant updatedAt
) {
    public static JobResponse from(Job job) {
        return new JobResponse(
                job.getId(),
                job.getName(),
                job.getJobType(),
                job.getTargetUrl(),
                job.getIntervalSeconds(),
                job.isEnabled(),
                job.getTemporalScheduleId(),
                job.getScheduleStatus(),
                job.getCreatedAt(),
                job.getUpdatedAt()
        );
    }
}

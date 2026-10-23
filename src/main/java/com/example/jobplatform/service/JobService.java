package com.example.jobplatform.service;

import com.example.jobplatform.dto.JobRegistrationRequest;
import com.example.jobplatform.dto.JobResponse;
import com.example.jobplatform.entity.Job;
import com.example.jobplatform.entity.ScheduleStatus;
import com.example.jobplatform.exception.JobNotFoundException;
import com.example.jobplatform.repository.JobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class JobService {

    private static final Logger log = LoggerFactory.getLogger(JobService.class);

    private final JobRepository jobRepository;
    private final JobSchedulingService jobSchedulingService;

    public JobService(JobRepository jobRepository, JobSchedulingService jobSchedulingService) {
        this.jobRepository = jobRepository;
        this.jobSchedulingService = jobSchedulingService;
    }

    public JobResponse register(JobRegistrationRequest request) {
        Job job = new Job();
        job.setName(request.name());
        job.setJobType(request.jobType());
        job.setTargetUrl(request.targetUrl());
        job.setIntervalSeconds(request.intervalSeconds());
        job.setEnabled(request.enabled() == null || request.enabled());
        job.setScheduleStatus(ScheduleStatus.PENDING);
        job = jobRepository.save(job);
        job = trySchedule(job);
        return JobResponse.from(job);
    }

    public JobResponse schedule(UUID id) {
        Job job = jobRepository.findById(id).orElseThrow(() -> new JobNotFoundException(id));
        return JobResponse.from(trySchedule(job));
    }

    private Job trySchedule(Job job) {
        if (job.getScheduleStatus() == ScheduleStatus.SCHEDULED && job.getTemporalScheduleId() != null) {
            return job;
        }
        try {
            job.setTemporalScheduleId(jobSchedulingService.createSchedule(job));
            job.setScheduleStatus(ScheduleStatus.SCHEDULED);
        } catch (Exception e) {
            log.error("Failed to create temporal schedule for job {}", job.getId(), e);
            job.setScheduleStatus(ScheduleStatus.FAILED);
        }
        return jobRepository.save(job);
    }

    public List<JobResponse> findAll() {
        return jobRepository.findAll().stream().map(JobResponse::from).toList();
    }

    public JobResponse findById(UUID id) {
        return jobRepository.findById(id)
                .map(JobResponse::from)
                .orElseThrow(() -> new JobNotFoundException(id));
    }
}

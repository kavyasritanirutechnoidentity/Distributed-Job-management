package com.example.jobplatform.service;

import com.example.jobplatform.dto.JobRegistrationRequest;
import com.example.jobplatform.dto.JobResponse;
import com.example.jobplatform.entity.Job;
import com.example.jobplatform.entity.ScheduleStatus;
import com.example.jobplatform.exception.JobNotFoundException;
import com.example.jobplatform.repository.JobRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class JobService {

    private final JobRepository jobRepository;

    public JobService(JobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    public JobResponse register(JobRegistrationRequest request) {
        Job job = new Job();
        job.setName(request.name());
        job.setJobType(request.jobType());
        job.setTargetUrl(request.targetUrl());
        job.setIntervalSeconds(request.intervalSeconds());
        job.setEnabled(request.enabled() == null || request.enabled());
        job.setScheduleStatus(ScheduleStatus.PENDING);
        return JobResponse.from(jobRepository.save(job));
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

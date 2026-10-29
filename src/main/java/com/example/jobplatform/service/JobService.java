package com.example.jobplatform.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.jobplatform.entity.JobRegistration;
import com.example.jobplatform.repository.JobRegistrationRepository;
import com.example.jobplatform.dto.JobRegistrationRequest;
import com.example.jobplatform.dto.JobResponse;
import com.example.jobplatform.entity.Job;
import com.example.jobplatform.entity.ScheduleStatus;
import com.example.jobplatform.exception.JobNotFoundException;
import com.example.jobplatform.repository.JobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class JobService {

    private static final Logger log = LoggerFactory.getLogger(JobService.class);

    private final JobRepository jobRepository;
    private final JobSchedulingService jobSchedulingService;

    private final JobRegistrationRepository registrationRepository;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate registrationTransaction;

    public JobService(JobRepository jobRepository, JobSchedulingService jobSchedulingService,
                      JobRegistrationRepository registrationRepository, ObjectMapper objectMapper,
                      PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.jobSchedulingService = jobSchedulingService;
        this.registrationRepository = registrationRepository;
        this.objectMapper = objectMapper;
        this.registrationTransaction = new TransactionTemplate(transactionManager);
        this.registrationTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.registrationTransaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.registrationTransaction.setTimeout(30);
    }

    public JobResponse register(String key, JobRegistrationRequest request) {
        if (key == null || key.isBlank() || key.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Idempotency-Key must contain 1 to 255 characters and must not be blank");
        }
        JobRegistrationRequest normalized = new JobRegistrationRequest(request.name(), request.jobType(),
                request.targetUrl(), request.intervalSeconds(), request.enabled() == null || request.enabled());
        String payload = serialize(normalized);

        registrationTransaction.executeWithoutResult(status -> {
            registrationRepository.reserve(key, payload);
            JobRegistration registration = registrationRepository.findByKeyForUpdate(key).orElseThrow();
            if (!registration.getRequestPayload().equals(payload)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Idempotency-Key has already been used with a different request");
            }
            if (registration.getJobId() == null) {
                Job job = jobRepository.save(newJob(normalized));
                registration.setJobId(job.getId());
                registrationRepository.save(registration);
            }
        });

        return registrationTransaction.execute(status -> {
            JobRegistration registration = registrationRepository.findByKeyForUpdate(key).orElseThrow();
            if (registration.getResponsePayload() != null) {
                return deserializeResponse(registration.getResponsePayload());
            }
            UUID jobId = registration.getJobId();
            Job job = jobRepository.findById(jobId).orElseThrow(() -> new JobNotFoundException(jobId));
            job = trySchedule(job);
            jobRepository.flush();
            JobResponse response = JobResponse.from(job);
            registration.setResponsePayload(serialize(response));
            registrationRepository.save(registration);
            return response;
        });
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialize registration data", e);
        }
    }

    private JobResponse deserializeResponse(String payload) {
        try {
            return objectMapper.readValue(payload, JobResponse.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not read stored registration response", e);
        }
    }

    public JobResponse register(JobRegistrationRequest request) {
        Job job = jobRepository.save(newJob(request));
        return JobResponse.from(trySchedule(job));
    }

    private Job newJob(JobRegistrationRequest request) {
        Job job = new Job();
        job.setName(request.name());
        job.setJobType(request.jobType());
        job.setTargetUrl(request.targetUrl());
        job.setIntervalSeconds(request.intervalSeconds());
        job.setEnabled(request.enabled() == null || request.enabled());
        job.setScheduleStatus(ScheduleStatus.PENDING);
        return job;
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

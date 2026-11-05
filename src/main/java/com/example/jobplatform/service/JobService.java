package com.example.jobplatform.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.jobplatform.config.TemporalProperties;
import com.example.jobplatform.dto.JobExecutionResponse;
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
import io.temporal.api.workflow.v1.WorkflowExecutionInfo;
import io.temporal.api.workflowservice.v1.ListWorkflowExecutionsRequest;
import io.temporal.api.workflowservice.v1.ListWorkflowExecutionsResponse;
import io.temporal.serviceclient.WorkflowServiceStubs;

import java.time.Instant;
import java.util.Comparator;
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
    private final WorkflowServiceStubs serviceStubs;
    private final TemporalProperties temporalProperties;
    private final TargetUrlPolicy targetUrlPolicy;

    public JobService(JobRepository jobRepository, JobSchedulingService jobSchedulingService,
                      JobRegistrationRepository registrationRepository, ObjectMapper objectMapper,
                      PlatformTransactionManager transactionManager,
                      WorkflowServiceStubs serviceStubs, TemporalProperties temporalProperties,
                      TargetUrlPolicy targetUrlPolicy) {
        this.jobRepository = jobRepository;
        this.jobSchedulingService = jobSchedulingService;
        this.registrationRepository = registrationRepository;
        this.objectMapper = objectMapper;
        this.serviceStubs = serviceStubs;
        this.temporalProperties = temporalProperties;
        this.targetUrlPolicy = targetUrlPolicy;
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
        validateTargetUrl(normalized.targetUrl());
        String payload = serialize(normalized);

        UUID jobId = registrationTransaction.execute(status -> {
            registrationRepository.reserve(key, payload);
            JobRegistration registration = registrationRepository.findByKeyForUpdate(key).orElseThrow();
            if (!registration.getRequestPayload().equals(payload)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Idempotency-Key has already been used with a different request");
            }
            if (registration.getJobId() == null) {
                Job job = saveNewJob(normalized);
                registration.setJobId(job.getId());
                registrationRepository.save(registration);
            }
            return registration.getJobId();
        });

        // A stored response short-circuits before any Temporal work.
        JobResponse replay = registrationTransaction.execute(status -> {
            JobRegistration registration = registrationRepository.findByKeyForUpdate(key).orElseThrow();
            return registration.getResponsePayload() != null
                    ? deserializeResponse(registration.getResponsePayload()) : null;
        });
        if (replay != null) {
            return replay;
        }

        syncSchedule(jobId);

        return registrationTransaction.execute(status -> {
            JobRegistration registration = registrationRepository.findByKeyForUpdate(key).orElseThrow();
            Job job = jobRepository.findById(registration.getJobId())
                    .orElseThrow(() -> new JobNotFoundException(registration.getJobId()));
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
        return register(UUID.randomUUID().toString(), request);
    }

    private Job saveNewJob(JobRegistrationRequest request) {
        jobRepository.lockRegistration(request.name(), request.targetUrl());
        if (jobRepository.existsByNameAndTargetUrl(request.name(), request.targetUrl())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A job with this name and target URL already exists");
        }
        return jobRepository.save(newJob(request));
    }

    private void validateTargetUrl(String targetUrl) {
        try {
            targetUrlPolicy.validate(targetUrl);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
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
        return syncSchedule(id);
    }

    public JobResponse update(UUID id, JobRegistrationRequest request) {
        validateTargetUrl(request.targetUrl());
        JobResponse committed = registrationTransaction.execute(status -> {
            Job job = jobRepository.findByIdForUpdate(id).orElseThrow(() -> new JobNotFoundException(id));
            jobRepository.lockRegistration(request.name(), request.targetUrl());
            if (jobRepository.existsByNameAndTargetUrlAndIdNot(request.name(), request.targetUrl(), id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "A job with this name and target URL already exists");
            }
            job.setName(request.name());
            job.setJobType(request.jobType());
            job.setTargetUrl(request.targetUrl());
            job.setIntervalSeconds(request.intervalSeconds());
            job.setEnabled(request.enabled() == null || request.enabled());
            jobRepository.flush();
            return JobResponse.from(job);
        });
        if (committed.scheduleStatus() == ScheduleStatus.SCHEDULED && committed.temporalScheduleId() != null) {
            return syncSchedule(id);
        }
        return committed;
    }

    public void delete(UUID id) {
        synchronized (stripeFor(id)) {
            String scheduleId = registrationTransaction.execute(status -> jobRepository
                    .findByIdForUpdate(id)
                    .orElseThrow(() -> new JobNotFoundException(id))
                    .getTemporalScheduleId());
            if (scheduleId != null) {
                try {
                    jobSchedulingService.deleteSchedule(scheduleId);
                } catch (RuntimeException e) {
                    if (isScheduleNotFound(e)) {
                        log.info("Temporal schedule {} for job {} was already deleted", scheduleId, id);
                    } else {
                        // Abort: leave the job in place so the deletion can be retried
                        // instead of orphaning a schedule that keeps executing.
                        throw e;
                    }
                }
            }
            registrationTransaction.executeWithoutResult(status -> {
                Job job = jobRepository.findByIdForUpdate(id).orElseThrow(() -> new JobNotFoundException(id));
                registrationRepository.deleteByJobId(id);
                jobRepository.delete(job);
                jobRepository.flush();
            });
        }
    }

    // JVM-local stripe locks serialize Temporal schedule mutations per job. A
    // multi-instance deployment would need distributed locking or a single
    // scheduling owner — out of scope for this single-node platform.
    private static final int SCHEDULE_LOCK_STRIPES = 64;
    private final Object[] scheduleLocks = new Object[SCHEDULE_LOCK_STRIPES];
    {
        java.util.Arrays.setAll(scheduleLocks, i -> new Object());
    }

    private Object stripeFor(UUID id) {
        return scheduleLocks[Math.floorMod(id.hashCode(), SCHEDULE_LOCK_STRIPES)];
    }

    private JobResponse syncSchedule(UUID id) {
        synchronized (stripeFor(id)) {
            Job job = registrationTransaction.execute(status -> jobRepository.findById(id)
                    .orElseThrow(() -> new JobNotFoundException(id)));
            try {
                if (job.getScheduleStatus() == ScheduleStatus.SCHEDULED
                        && job.getTemporalScheduleId() != null) {
                    jobSchedulingService.updateSchedule(job);
                } else {
                    persistSchedule(id, jobSchedulingService.createSchedule(job));
                }
            } catch (RuntimeException e) {
                if (isScheduleNotFound(e)) {
                    log.info("Temporal schedule {} missing for job {}; marking it FAILED for recreation",
                            job.getTemporalScheduleId(), id);
                } else {
                    log.error("Failed to synchronize temporal schedule for job {}", id, e);
                }
                markScheduleFailed(id);
            }
            return registrationTransaction.execute(status -> JobResponse.from(
                    jobRepository.findById(id).orElseThrow(() -> new JobNotFoundException(id))));
        }
    }

    private void persistSchedule(UUID id, String scheduleId) {
        registrationTransaction.executeWithoutResult(status ->
                jobRepository.findByIdForUpdate(id).ifPresent(job -> {
                    job.setTemporalScheduleId(scheduleId);
                    job.setScheduleStatus(ScheduleStatus.SCHEDULED);
                    jobRepository.flush();
                }));
    }

    private void markScheduleFailed(UUID id) {
        registrationTransaction.executeWithoutResult(status ->
                jobRepository.findByIdForUpdate(id).ifPresent(job -> {
                    if (job.getScheduleStatus() != ScheduleStatus.FAILED) {
                        job.setScheduleStatus(ScheduleStatus.FAILED);
                        jobRepository.flush();
                    }
                }));
    }

    public com.example.jobplatform.dto.JobPageResponse findAll(int page, int size, String search,
            ScheduleStatus scheduleStatus, Boolean enabled, String sort, String direction) {
        if (page < 0 || size < 1 || size > 100 || search.length() > 255
                || !List.of("name", "createdAt", "updatedAt", "intervalSeconds", "scheduleStatus").contains(sort)
                || !List.of("asc", "desc").contains(direction)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination, search or sorting parameters");
        }
        org.springframework.data.jpa.domain.Specification<Job> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (!search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(java.util.Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("name")), pattern, '\\'),
                        cb.like(cb.lower(root.get("targetUrl")), pattern, '\\')));
            }
            if (scheduleStatus != null) predicates.add(cb.equal(root.get("scheduleStatus"), scheduleStatus));
            if (enabled != null) predicates.add(cb.equal(root.get("enabled"), enabled));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var order = org.springframework.data.domain.Sort.by(
                org.springframework.data.domain.Sort.Direction.fromString(direction), sort).and(
                org.springframework.data.domain.Sort.by("id"));
        var result = jobRepository.findAll(spec, org.springframework.data.domain.PageRequest.of(page, size, order));
        return new com.example.jobplatform.dto.JobPageResponse(result.getContent().stream()
                .map(JobResponse::from).toList(), result.getTotalElements(), result.getTotalPages(), result.getNumber());
    }

    public com.example.jobplatform.dto.JobDashboardResponse dashboard() {
        return new com.example.jobplatform.dto.JobDashboardResponse(jobRepository.count(),
                jobRepository.countByScheduleStatus(ScheduleStatus.SCHEDULED),
                jobRepository.countByScheduleStatus(ScheduleStatus.PENDING),
                jobRepository.countByScheduleStatus(ScheduleStatus.FAILED), jobRepository.countByEnabledTrue(),
                countFailedRunsLast24h(),
                findAll(0, 6, "", null, null, "updatedAt", "desc").content(),
                findAll(0, 5, "", ScheduleStatus.FAILED, null, "updatedAt", "desc").content());
    }

    private Long countFailedRunsLast24h() {
        try {
            String since = Instant.now().minusSeconds(86_400).toString();
            return serviceStubs.blockingStub().countWorkflowExecutions(
                    io.temporal.api.workflowservice.v1.CountWorkflowExecutionsRequest.newBuilder()
                            .setNamespace(temporalProperties.namespace())
                            .setQuery("WorkflowId STARTS_WITH 'health-check-' AND ExecutionStatus = 'Failed'"
                                    + " AND StartTime > \"" + since + "\"")
                            .build()).getCount();
        } catch (RuntimeException e) {
            log.warn("Could not count failed executions in Temporal: {}", e.getMessage());
            return null;
        }
    }

    public JobResponse findById(UUID id) {
        return jobRepository.findById(id)
                .map(JobResponse::from)
                .orElseThrow(() -> new JobNotFoundException(id));
    }

    public List<JobExecutionResponse> findExecutions(UUID id) {
        if (!jobRepository.existsById(id)) {
            throw new JobNotFoundException(id);
        }
        ListWorkflowExecutionsResponse response = serviceStubs.blockingStub()
                .listWorkflowExecutions(ListWorkflowExecutionsRequest.newBuilder()
                        .setNamespace(temporalProperties.namespace())
                        .setPageSize(15)
                        .setQuery("WorkflowId STARTS_WITH 'health-check-" + id + "'")
                        .build());
        return response.getExecutionsList().stream()
                .sorted(Comparator.comparing((WorkflowExecutionInfo e) -> e.getStartTime().getSeconds())
                        .reversed())
                .map(JobService::toExecutionResponse)
                .toList();
    }

    private static boolean isScheduleNotFound(RuntimeException e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof io.grpc.StatusRuntimeException sre
                    && sre.getStatus().getCode() == io.grpc.Status.Code.NOT_FOUND) {
                return true;
            }
        }
        return false;
    }

    private static JobExecutionResponse toExecutionResponse(WorkflowExecutionInfo info) {
        Instant start = Instant.ofEpochSecond(
                info.getStartTime().getSeconds(), info.getStartTime().getNanos());
        Instant close = info.hasCloseTime()
                ? Instant.ofEpochSecond(info.getCloseTime().getSeconds(), info.getCloseTime().getNanos())
                : null;
        Long durationMs = close == null ? null : close.toEpochMilli() - start.toEpochMilli();
        return new JobExecutionResponse(
                info.getExecution().getWorkflowId(),
                info.getStatus().name().replace("WORKFLOW_EXECUTION_STATUS_", ""),
                start, close, durationMs);
    }
}

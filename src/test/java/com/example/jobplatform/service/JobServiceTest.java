package com.example.jobplatform.service;

import com.example.jobplatform.dto.JobRegistrationRequest;
import com.example.jobplatform.dto.JobResponse;
import com.example.jobplatform.entity.Job;
import com.example.jobplatform.entity.JobRegistration;
import com.example.jobplatform.config.TemporalProperties;
import com.example.jobplatform.entity.JobType;
import com.example.jobplatform.entity.ScheduleStatus;
import com.example.jobplatform.repository.JobRegistrationRepository;
import com.example.jobplatform.repository.JobRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.mockito.InOrder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.server.ResponseStatusException;
import io.temporal.serviceclient.WorkflowServiceStubs;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class JobServiceTest {

    private final JobRepository jobs = mock(JobRepository.class);
    private final JobRegistrationRepository registrations = mock(JobRegistrationRepository.class);
    private final JobSchedulingService scheduling = mock(JobSchedulingService.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final Map<String, JobRegistration> storedRegistrations = new HashMap<>();
    private final Map<UUID, Job> storedJobs = new HashMap<>();
    private final JobRegistrationRequest request = new JobRegistrationRequest(
            "health", JobType.HEALTH_CHECK, "http://localhost:8080/api/jobs", 10L, true);
    private JobService service;

    @BeforeEach
    void setUp() {
        when(transactions.getTransaction(any())).thenAnswer(invocation -> {
            TransactionDefinition definition = invocation.getArgument(0);
            assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, definition.getPropagationBehavior());
            assertEquals(TransactionDefinition.ISOLATION_READ_COMMITTED, definition.getIsolationLevel());
            return new SimpleTransactionStatus();
        });
        when(registrations.reserve(anyString(), anyString())).thenAnswer(invocation -> {
            String key = invocation.getArgument(0);
            if (storedRegistrations.containsKey(key)) {
                return 0;
            }
            JobRegistration registration = new JobRegistration();
            ReflectionTestUtils.setField(registration, "idempotencyKey", key);
            ReflectionTestUtils.setField(registration, "requestPayload", invocation.getArgument(1));
            storedRegistrations.put(key, registration);
            return 1;
        });
        when(registrations.findByKeyForUpdate(anyString())).thenAnswer(invocation ->
                Optional.ofNullable(storedRegistrations.get(invocation.getArgument(0))));
        when(jobs.save(any(Job.class))).thenAnswer(invocation -> {
            Job job = invocation.getArgument(0);
            if (job.getId() == null) {
                ReflectionTestUtils.setField(job, "id", UUID.randomUUID());
            }
            storedJobs.put(job.getId(), job);
            return job;
        });
        when(jobs.existsByNameAndTargetUrl(anyString(), anyString())).thenAnswer(invocation ->
                storedJobs.values().stream().anyMatch(job -> job.getName().equals(invocation.getArgument(0))
                        && job.getTargetUrl().equals(invocation.getArgument(1))));
        when(jobs.findByIdForUpdate(any())).thenAnswer(invocation ->
                Optional.ofNullable(storedJobs.get(invocation.getArgument(0))));
        doAnswer(invocation -> "job-" + ((Job) invocation.getArgument(0)).getId())
                .when(scheduling).createSchedule(any());
        service = new JobService(jobs, scheduling, registrations,
                new ObjectMapper().findAndRegisterModules(), transactions,
                mock(WorkflowServiceStubs.class),
                new TemporalProperties("localhost:7233", "default", "test-queue"), mock(TargetUrlPolicy.class));
    }

    @Test
    void registersAndStoresOriginalResponse() {
        JobResponse response = service.register("first", request);

        assertEquals(ScheduleStatus.SCHEDULED, response.scheduleStatus());
        assertEquals("job-" + response.id(), response.temporalScheduleId());
        assertEquals(1, storedJobs.size());
        assertNotNull(storedRegistrations.get("first").getResponsePayload());
        verify(transactions, times(2)).commit(any());
    }

    @Test
    void replaysSnapshotWithoutAnotherJobOrSchedule() {
        JobResponse original = service.register("first", request);
        storedJobs.get(original.id()).setScheduleStatus(ScheduleStatus.FAILED);

        assertEquals(original, service.register("first", request));
        assertEquals(1, storedJobs.size());
        verify(scheduling, times(1)).createSchedule(any());
    }

    @Test
    void rejectsDifferentPayloadForSameKey() {
        service.register("first", request);
        JobRegistrationRequest changed = new JobRegistrationRequest(
                "changed", request.jobType(), request.targetUrl(), request.intervalSeconds(), true);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.register("first", changed));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals(1, storedJobs.size());
        verify(scheduling, times(1)).createSchedule(any());
        verify(transactions).rollback(any());
    }

    @Test
    void rejectsDifferentKeysWithSameNameAndTarget() {
        service.register("first", request);
        JobRegistrationRequest changedInterval = new JobRegistrationRequest(
                request.name(), request.jobType(), request.targetUrl(), 60L, false);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.register("second", changedInterval));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals("A job with this name and target URL already exists", exception.getReason());
        assertEquals(1, storedJobs.size());
        verify(scheduling, times(1)).createSchedule(any());
    }

    @Test
    void permitsSameTargetWithDifferentNameAndSameNameWithDifferentTarget() {
        service.register("first", request);
        service.register("second", new JobRegistrationRequest(
                "another", request.jobType(), request.targetUrl(), 10L, true));
        service.register("third", new JobRegistrationRequest(
                request.name(), request.jobType(), "http://localhost:8080/other", 10L, true));

        assertEquals(3, storedJobs.size());
    }

    @Test
    void rejectsDuplicatesWithoutIdempotencyKey() {
        service.register(request);
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.register(request));
        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals(1, storedJobs.size());
    }

    @Test
    void normalizesOmittedEnabledToTrue() {
        JobRegistrationRequest omitted = new JobRegistrationRequest(
                request.name(), request.jobType(), request.targetUrl(), request.intervalSeconds(), null);

        assertEquals(service.register("first", omitted), service.register("first", request));
        verify(scheduling, times(1)).createSchedule(any());
    }

    @Test
    void replaysSchedulingFailureWithoutRetryingTemporal() {
        doThrow(new RuntimeException("Temporal unavailable")).when(scheduling).createSchedule(any());

        JobResponse failed = service.register("first", request);

        assertEquals(ScheduleStatus.FAILED, failed.scheduleStatus());
        assertEquals(failed, service.register("first", request));
        assertEquals(1, storedJobs.size());
        verify(scheduling, times(1)).createSchedule(any());
    }

    @Test
    void returnsRequestedPageWithStableSortAndTotals() {
        JobResponse registered = service.register("first", request);
        var pageable = org.springframework.data.domain.PageRequest.of(2, 10,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt")
                        .and(org.springframework.data.domain.Sort.by("id")));
        when(jobs.findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(
                        java.util.List.of(storedJobs.get(registered.id())), pageable, 21));

        var response = service.findAll(2, 10, "health", ScheduleStatus.SCHEDULED, true, "createdAt", "desc");

        assertEquals(21, response.totalElements());
        assertEquals(3, response.totalPages());
        assertEquals(2, response.number());
        assertEquals(registered, response.content().getFirst());
    }

    @Test
    void rejectsUnboundedPagesAndUnknownSorts() {
        assertThrows(ResponseStatusException.class,
                () -> service.findAll(0, 101, "", null, null, "createdAt", "desc"));
        assertThrows(ResponseStatusException.class,
                () -> service.findAll(-1, 25, "", null, null, "createdAt", "desc"));
        assertThrows(ResponseStatusException.class,
                () -> service.findAll(0, 25, "", null, null, "targetUrl", "desc"));
        verifyNoInteractions(jobs);
    }

    @Test
    void dashboardUsesAggregateCountsAndBoundedQueries() {
        when(jobs.count()).thenReturn(5000L);
        when(jobs.countByScheduleStatus(ScheduleStatus.SCHEDULED)).thenReturn(4900L);
        when(jobs.countByScheduleStatus(ScheduleStatus.PENDING)).thenReturn(80L);
        when(jobs.countByScheduleStatus(ScheduleStatus.FAILED)).thenReturn(20L);
        when(jobs.countByEnabledTrue()).thenReturn(4500L);
        when(jobs.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(org.springframework.data.domain.Page.empty());

        var dashboard = service.dashboard();

        assertEquals(5000L, dashboard.total());
        assertEquals(4900L, dashboard.scheduled());
        assertEquals(80L, dashboard.pending());
        assertEquals(20L, dashboard.failed());
        assertEquals(4500L, dashboard.enabled());
        verify(jobs, never()).findAll();
        verify(jobs).findAll(any(org.springframework.data.jpa.domain.Specification.class),
                argThat((org.springframework.data.domain.Pageable p) -> p.getPageSize() == 6));
        verify(jobs).findAll(any(org.springframework.data.jpa.domain.Specification.class),
                argThat((org.springframework.data.domain.Pageable p) -> p.getPageSize() == 5));
    }

    @Test
    void updateTakesRegistrationIdentityLockBeforeDuplicateCheck() {
        JobResponse registered = service.register("first", request);
        JobRegistrationRequest updated = new JobRegistrationRequest(
                "renamed", request.jobType(), "https://example.com/other", 30L, true);

        service.update(registered.id(), updated);

        var inOrder = inOrder(jobs);
        inOrder.verify(jobs, times(2)).findByIdForUpdate(registered.id());
        inOrder.verify(jobs).lockRegistration(updated.name(), updated.targetUrl());
        inOrder.verify(jobs).existsByNameAndTargetUrlAndIdNot(
                updated.name(), updated.targetUrl(), registered.id());
    }

    @Test
    void updateRejectsIdentityHeldByAnotherJob() {
        service.register("first", request);
        JobResponse second = service.register("second", new JobRegistrationRequest(
                "other", request.jobType(), "https://example.com/other", 10L, true));
        when(jobs.existsByNameAndTargetUrlAndIdNot(request.name(), request.targetUrl(), second.id()))
                .thenReturn(true);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.update(second.id(), request));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals("A job with this name and target URL already exists", exception.getReason());
        verify(jobs, times(2)).lockRegistration(request.name(), request.targetUrl());
    }

    @Test
    void locksOnlyTheRegistrationIdentity() {
        service.register("first", request);
        verify(jobs).lockRegistration(request.name(), request.targetUrl());
    }

    @Test
    void rejectsInvalidKeysBeforePersistence() {
        for (String key : new String[]{null, "", "   ", "a".repeat(256)}) {
            ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                    () -> service.register(key, request));
            assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        }
        verifyNoInteractions(registrations, jobs, scheduling, transactions);
    }

    private JobResponse registerJob() {
        return service.register(UUID.randomUUID().toString(), request);
    }

    @Test
    void deleteRemovesScheduleThenJob() {
        JobResponse job = registerJob();

        service.delete(job.id());

        InOrder inOrder = inOrder(scheduling, jobs);
        inOrder.verify(scheduling).deleteSchedule("job-" + job.id());
        inOrder.verify(jobs).delete(argThat((Job j) -> j.getId().equals(job.id())));
        verify(registrations).deleteByJobId(job.id());
    }

    @Test
    void deleteProceedsWhenScheduleAlreadyMissing() {
        JobResponse job = registerJob();
        doThrow(new io.grpc.StatusRuntimeException(io.grpc.Status.NOT_FOUND))
                .when(scheduling).deleteSchedule(anyString());

        service.delete(job.id());

        verify(jobs).delete(argThat((Job j) -> j.getId().equals(job.id())));
    }

    @Test
    void deleteAbortsWhenTemporalDeletionFails() {
        JobResponse job = registerJob();
        doThrow(new io.grpc.StatusRuntimeException(io.grpc.Status.UNAVAILABLE))
                .when(scheduling).deleteSchedule(anyString());

        assertThrows(io.grpc.StatusRuntimeException.class, () -> service.delete(job.id()));

        verify(jobs, never()).delete(any(Job.class));
        verify(registrations, never()).deleteByJobId(any());
        verify(transactions, atLeastOnce()).rollback(any());
    }

    @Test
    void deletePropagatesDatabaseFailureAfterScheduleDeletion() {
        JobResponse job = registerJob();
        doThrow(new org.springframework.dao.DataIntegrityViolationException("db gone"))
                .when(jobs).delete(any(Job.class));

        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> service.delete(job.id()));
    }
}

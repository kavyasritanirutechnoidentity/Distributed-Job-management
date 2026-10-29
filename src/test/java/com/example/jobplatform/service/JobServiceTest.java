package com.example.jobplatform.service;

import com.example.jobplatform.dto.JobRegistrationRequest;
import com.example.jobplatform.dto.JobResponse;
import com.example.jobplatform.entity.Job;
import com.example.jobplatform.entity.JobRegistration;
import com.example.jobplatform.entity.JobType;
import com.example.jobplatform.entity.ScheduleStatus;
import com.example.jobplatform.repository.JobRegistrationRepository;
import com.example.jobplatform.repository.JobRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.server.ResponseStatusException;

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
        when(jobs.findById(any())).thenAnswer(invocation ->
                Optional.ofNullable(storedJobs.get(invocation.getArgument(0))));
        doAnswer(invocation -> "job-" + ((Job) invocation.getArgument(0)).getId())
                .when(scheduling).createSchedule(any());
        service = new JobService(jobs, scheduling, registrations,
                new ObjectMapper().findAndRegisterModules(), transactions);
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
    void permitsDifferentKeysWithSamePayload() {
        JobResponse first = service.register("first", request);
        JobResponse second = service.register("second", request);

        assertNotEquals(first.id(), second.id());
        assertEquals(2, storedJobs.size());
        verify(scheduling, times(2)).createSchedule(any());
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
    void rejectsInvalidKeysBeforePersistence() {
        for (String key : new String[]{null, "", "   ", "a".repeat(256)}) {
            ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                    () -> service.register(key, request));
            assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        }
        verifyNoInteractions(registrations, jobs, scheduling, transactions);
    }
}

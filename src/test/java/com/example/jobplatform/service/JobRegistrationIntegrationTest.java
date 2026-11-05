package com.example.jobplatform.service;

import com.example.jobplatform.config.TemporalProperties;
import com.example.jobplatform.controller.JobController;
import com.example.jobplatform.dto.JobRegistrationRequest;
import com.example.jobplatform.entity.Job;
import com.example.jobplatform.entity.JobType;
import com.example.jobplatform.exception.GlobalExceptionHandler;
import com.example.jobplatform.repository.JobRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.temporal.serviceclient.WorkflowServiceStubs;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({JobService.class, JobRegistrationIntegrationTest.Config.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class JobRegistrationIntegrationTest {
    @Autowired JobService service;
    @Autowired JobRepository jobs;
    @Autowired ObjectMapper mapper;
    @MockitoBean JobSchedulingService scheduling;
    @MockitoBean WorkflowServiceStubs stubs;
    @MockitoBean TargetUrlPolicy targetUrlPolicy;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> "verification");
        registry.add("spring.datasource.password", () -> "verification");
    }

    @TestConfiguration
    static class Config {
        @Bean ObjectMapper mapper() { return new ObjectMapper().findAndRegisterModules(); }
        @Bean TemporalProperties properties() {
            return new TemporalProperties("localhost:7233", "default", "verification");
        }
    }

    @BeforeEach
    void scheduling() {
        when(scheduling.createSchedule(any())).thenAnswer(call -> "job-" + ((Job) call.getArgument(0)).getId());
    }

    private JobRegistrationRequest request() {
        return new JobRegistrationRequest("verification-" + UUID.randomUUID(), JobType.HEALTH_CHECK,
                "http://localhost:8080/api/jobs", 60L, true);
    }

    @Test
    void concurrentSameKeyCreatesOneJobAndReplaysCommittedResponse() throws Exception {
        var request = request();
        String key = UUID.randomUUID().toString();
        try (var executor = Executors.newFixedThreadPool(6)) {
            var start = new CountDownLatch(1);
            var calls = new ArrayList<Callable<com.example.jobplatform.dto.JobResponse>>();
            for (int i = 0; i < 6; i++) calls.add(() -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                return service.register(key, request);
            });
            var futures = calls.stream().map(executor::submit).toList();
            start.countDown();
            var original = futures.getFirst().get(20, TimeUnit.SECONDS);
            for (var future : futures) assertEquals(original, future.get(20, TimeUnit.SECONDS));
            assertEquals(original, service.register(key, request));
            verify(scheduling, times(1)).createSchedule(any());
        }
    }

    @Test
    void concurrentDifferentKeysRejectDuplicateIdentity() throws Exception {
        var request = request();
        try (var executor = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            Callable<Boolean> call = () -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                try {
                    service.register(UUID.randomUUID().toString(), request);
                    return true;
                } catch (ResponseStatusException e) {
                    assertEquals(409, e.getStatusCode().value());
                    return false;
                }
            };
            var first = executor.submit(call);
            var second = executor.submit(call);
            start.countDown();
            assertNotEquals(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
            verify(scheduling, times(1)).createSchedule(any());
        }
    }

    @Test
    void concurrentRecoveryCreatesOneSchedule() throws Exception {
        doThrow(new IllegalStateException("verification outage")).when(scheduling).createSchedule(any());
        var registered = service.register(UUID.randomUUID().toString(), request());
        assertEquals(com.example.jobplatform.entity.ScheduleStatus.FAILED, registered.scheduleStatus());
        reset(scheduling);
        when(scheduling.createSchedule(any())).thenAnswer(call -> {
            Thread.sleep(100);
            return "job-" + ((Job) call.getArgument(0)).getId();
        });
        try (var executor = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            Callable<com.example.jobplatform.dto.JobResponse> recover = () -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                return service.schedule(registered.id());
            };
            var first = executor.submit(recover);
            var second = executor.submit(recover);
            start.countDown();
            assertEquals(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
            verify(scheduling, times(1)).createSchedule(any());
        }
    }

    @Test
    void databaseRejectsDuplicateEvenWhenServiceIsBypassed() {
        var request = request();
        service.register(UUID.randomUUID().toString(), request);
        Job duplicate = new Job();
        duplicate.setName(request.name());
        duplicate.setTargetUrl(request.targetUrl());
        duplicate.setJobType(request.jobType());
        duplicate.setIntervalSeconds(request.intervalSeconds());
        duplicate.setEnabled(true);
        duplicate.setScheduleStatus(com.example.jobplatform.entity.ScheduleStatus.PENDING);
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jobs.saveAndFlush(duplicate));
    }

    @Test
    void staleDetachedUpdateIsRejected() {
        var registered = service.register(UUID.randomUUID().toString(), request());
        var first = jobs.findById(registered.id()).orElseThrow();
        var stale = jobs.findById(registered.id()).orElseThrow();
        first.setIntervalSeconds(30L);
        jobs.saveAndFlush(first);
        stale.setIntervalSeconds(90L);
        assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,
                () -> jobs.saveAndFlush(stale));
        assertEquals(30L, jobs.findById(registered.id()).orElseThrow().getIntervalSeconds());
    }

    @Test
    void databaseFilteringPaginationAndLiteralSearchWork() {
        String prefix = "filter%_" + UUID.randomUUID();
        for (int i = 0; i < 3; i++) {
            service.register(UUID.randomUUID().toString(), new JobRegistrationRequest(
                    prefix + i, JobType.HEALTH_CHECK, "http://localhost:8080/api/jobs", 60L, true));
        }
        var page = service.findAll(1, 2, prefix,
                com.example.jobplatform.entity.ScheduleStatus.SCHEDULED, true, "name", "asc");
        assertEquals(3, page.totalElements());
        assertEquals(2, page.totalPages());
        assertEquals(1, page.content().size());
        assertEquals(prefix + "2", page.content().getFirst().name());
        assertEquals(0, service.findAll(0, 2, prefix, null, false, "name", "asc").totalElements());
    }

    @Test
    void controllerRequiresKeyAndReplaysRegistration() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new JobController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        var request = request();
        String body = mapper.writeValueAsString(request);
        String key = UUID.randomUUID().toString();
        mvc.perform(post("/api/jobs").contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
        String first = mvc.perform(post("/api/jobs").header("Idempotency-Key", key)
                        .contentType("application/json").content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String retry = mvc.perform(post("/api/jobs").header("Idempotency-Key", key)
                        .contentType("application/json").content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertEquals(mapper.readTree(first), mapper.readTree(retry));
        verify(scheduling, times(1)).createSchedule(any());
    }
}

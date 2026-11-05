package com.example.jobplatform.controller;

import com.example.jobplatform.dto.JobExecutionResponse;
import com.example.jobplatform.dto.JobRegistrationRequest;
import com.example.jobplatform.dto.JobResponse;
import com.example.jobplatform.service.JobService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    private final JobService jobService;

    public JobController(JobService jobService) {
        this.jobService = jobService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JobResponse register(
            @org.springframework.web.bind.annotation.RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody JobRegistrationRequest request) {
        return jobService.register(idempotencyKey, request);
    }

    @PostMapping("/{id}/schedule")
    public JobResponse schedule(@PathVariable UUID id) {
        return jobService.schedule(id);
    }

    @PutMapping("/{id}")
    public JobResponse update(@PathVariable UUID id, @Valid @RequestBody JobRegistrationRequest request) {
        return jobService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        jobService.delete(id);
    }

    @GetMapping
    public com.example.jobplatform.dto.JobPageResponse findAll(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "25") int size,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "") String search,
            @org.springframework.web.bind.annotation.RequestParam(required = false) com.example.jobplatform.entity.ScheduleStatus status,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Boolean enabled,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "createdAt") String sort,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "desc") String direction) {
        return jobService.findAll(page, size, search, status, enabled, sort, direction);
    }

    @GetMapping("/dashboard")
    public com.example.jobplatform.dto.JobDashboardResponse dashboard() {
        return jobService.dashboard();
    }

    @GetMapping("/{id}")
    public JobResponse findById(@PathVariable UUID id) {
        return jobService.findById(id);
    }

    @GetMapping("/{id}/executions")
    public List<JobExecutionResponse> findExecutions(@PathVariable UUID id) {
        return jobService.findExecutions(id);
    }
}

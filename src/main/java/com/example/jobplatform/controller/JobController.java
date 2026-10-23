package com.example.jobplatform.controller;

import com.example.jobplatform.dto.JobRegistrationRequest;
import com.example.jobplatform.dto.JobResponse;
import com.example.jobplatform.service.JobService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
    public JobResponse register(@Valid @RequestBody JobRegistrationRequest request) {
        return jobService.register(request);
    }

    @GetMapping
    public List<JobResponse> findAll() {
        return jobService.findAll();
    }

    @GetMapping("/{id}")
    public JobResponse findById(@PathVariable UUID id) {
        return jobService.findById(id);
    }
}

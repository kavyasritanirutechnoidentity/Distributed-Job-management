package com.example.jobplatform.dto;

import java.util.List;

public record JobPageResponse(List<JobResponse> content, long totalElements, int totalPages, int number) {
}

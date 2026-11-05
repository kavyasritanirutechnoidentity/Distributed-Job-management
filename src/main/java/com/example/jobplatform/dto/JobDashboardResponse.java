package com.example.jobplatform.dto;

import java.util.List;

public record JobDashboardResponse(long total, long scheduled, long pending, long failed, long enabled,
                                   Long failedRuns24h,
                                   List<JobResponse> recent, List<JobResponse> failures) {
}

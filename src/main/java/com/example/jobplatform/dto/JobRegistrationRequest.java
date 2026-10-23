package com.example.jobplatform.dto;

import com.example.jobplatform.entity.JobType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

public record JobRegistrationRequest(
        @NotBlank @Size(max = 255) String name,
        @NotNull JobType jobType,
        @NotBlank @URL @Size(max = 2048) String targetUrl,
        @NotNull @Min(10) Long intervalSeconds,
        Boolean enabled
) {
}

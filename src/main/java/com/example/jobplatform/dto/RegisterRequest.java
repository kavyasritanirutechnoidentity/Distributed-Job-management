package com.example.jobplatform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Pattern(regexp = "^[a-zA-Z0-9_.-]{3,50}$",
                message = "Username must be 3-50 characters (letters, digits, _, ., -)")
        String username,
        @NotBlank @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,100}$",
                message = "Password must be 8-100 characters with an uppercase letter, a lowercase letter, and a digit")
        String password) {
}

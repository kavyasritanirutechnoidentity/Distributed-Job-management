package com.example.jobplatform.dto;

import com.example.jobplatform.entity.Role;

public record AuthResponse(String token, String username, Role role) {
}

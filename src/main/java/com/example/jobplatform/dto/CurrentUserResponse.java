package com.example.jobplatform.dto;

import com.example.jobplatform.entity.Role;

public record CurrentUserResponse(String username, Role role) {
}

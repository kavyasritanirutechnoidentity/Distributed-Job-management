package com.example.jobplatform.controller;

import com.example.jobplatform.dto.AuthResponse;
import com.example.jobplatform.dto.CurrentUserResponse;
import com.example.jobplatform.dto.LoginRequest;
import com.example.jobplatform.dto.RegisterRequest;
import com.example.jobplatform.entity.Role;
import com.example.jobplatform.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request.username(), request.password());
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request,
                              jakarta.servlet.http.HttpServletRequest http) {
        return authService.login(request.username(), request.password(), http.getRemoteAddr());
    }

    @GetMapping("/me")
    public CurrentUserResponse me(Authentication authentication) {
        Role role = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> Role.valueOf(a.substring(5)))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Authenticated principal has no role"));
        return new CurrentUserResponse(authentication.getName(), role);
    }
}

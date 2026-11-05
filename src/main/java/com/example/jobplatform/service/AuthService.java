package com.example.jobplatform.service;

import com.example.jobplatform.dto.AuthResponse;
import com.example.jobplatform.entity.AppUser;
import com.example.jobplatform.entity.Role;
import com.example.jobplatform.repository.UserRepository;
import com.example.jobplatform.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(String username, String password) {
        if (users.existsByUsernameIgnoreCase(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already taken");
        }
        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(Role.VIEWER);
        users.save(user);
        return new AuthResponse(jwtService.issueToken(username, Role.VIEWER), username, Role.VIEWER);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(String username, String password) {
        AppUser user = users.findByUsername(username).orElse(null);
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
        return new AuthResponse(
                jwtService.issueToken(user.getUsername(), user.getRole()), user.getUsername(), user.getRole());
    }
}

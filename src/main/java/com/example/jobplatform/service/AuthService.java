package com.example.jobplatform.service;

import com.example.jobplatform.dto.AuthResponse;
import com.example.jobplatform.entity.AppUser;
import com.example.jobplatform.entity.Role;
import com.example.jobplatform.repository.UserRepository;
import com.example.jobplatform.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

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

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration LOCKOUT = Duration.ofMinutes(1);
    private static final Duration ENTRY_TTL = Duration.ofMinutes(10);
    private static final int MAX_TRACKED_KEYS = 10_000;
    // Valid BCrypt hash compared against when the user does not exist, so response
    // time does not reveal whether a username is registered.
    private static final String DUMMY_HASH =
            "$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW";

    private final Map<String, FailedLogin> failures = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public AuthResponse login(String username, String password, String remoteAddr) {
        // Key by username + source IP: limits the attacker without letting them
        // lock out the account for every other client.
        String key = username.toLowerCase(Locale.ROOT) + "@" + (remoteAddr == null ? "" : remoteAddr);
        FailedLogin failure = failures.get(key);
        if (failure != null && failure.lockedUntil().isAfter(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many failed login attempts. Try again later.");
        }
        AppUser user = users.findByUsername(username).orElse(null);
        boolean valid = user != null
                && passwordEncoder.matches(password, user.getPasswordHash());
        if (!valid) {
            if (user == null) {
                passwordEncoder.matches(password, DUMMY_HASH);
            }
            Instant now = Instant.now();
            Instant staleBefore = now.minus(ENTRY_TTL);
            failures.compute(key, (k, f) -> {
                if (f != null && f.lastAttempt().isBefore(staleBefore)) {
                    f = null;
                }
                int count = f == null ? 1 : f.count() + 1;
                Instant lockedUntil = count >= MAX_FAILED_ATTEMPTS
                        ? now.plus(LOCKOUT) : Instant.MIN;
                if (count == MAX_FAILED_ATTEMPTS) {
                    log.warn("Locking login attempts for '{}' from '{}' after {} failures",
                            username, remoteAddr, MAX_FAILED_ATTEMPTS);
                }
                return new FailedLogin(count, lockedUntil, now);
            });
            if (failures.size() > MAX_TRACKED_KEYS) {
                // Amortized sweep: only stale entries are reclaimed, so an
                // attacker can never push out a live lockout by rotating keys.
                failures.entrySet().removeIf(e -> e.getValue().lastAttempt().isBefore(staleBefore));
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
        failures.remove(key);
        return new AuthResponse(
                jwtService.issueToken(user.getUsername(), user.getRole()), user.getUsername(), user.getRole());
    }

    record FailedLogin(int count, Instant lockedUntil, Instant lastAttempt) {
    }
}

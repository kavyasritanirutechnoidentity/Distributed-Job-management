package com.example.jobplatform.service;

import com.example.jobplatform.entity.AppUser;
import com.example.jobplatform.entity.Role;
import com.example.jobplatform.repository.UserRepository;
import com.example.jobplatform.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {

    private static final String IP = "127.0.0.1";

    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private final JwtService jwt = mock(JwtService.class);
    private final AuthService service = new AuthService(users, encoder, jwt);

    private void seedUser() {
        AppUser user = new AppUser();
        user.setUsername("admin");
        user.setPasswordHash(encoder.encode("correct"));
        user.setRole(Role.ADMIN);
        when(users.findByUsername("admin")).thenReturn(Optional.of(user));
    }

    @Test
    void locksAfterFiveFailedAttemptsFromSameIp() {
        seedUser();
        for (int i = 0; i < 5; i++) {
            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> service.login("admin", "wrong", IP));
            assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
        }
        ResponseStatusException locked = assertThrows(ResponseStatusException.class,
                () -> service.login("admin", "correct", IP));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, locked.getStatusCode());
    }

    @Test
    void lockoutFromOneIpDoesNotBlockOtherClients() {
        seedUser();
        when(jwt.issueToken(any(), any())).thenReturn("token");
        for (int i = 0; i < 5; i++) {
            assertThrows(ResponseStatusException.class, () -> service.login("admin", "wrong", IP));
        }
        // a different client can still log in with the right password
        service.login("admin", "correct", "10.0.0.9");
    }

    @Test
    void successfulLoginClearsFailureCount() {
        seedUser();
        when(jwt.issueToken(any(), any())).thenReturn("token");

        for (int i = 0; i < 4; i++) {
            assertThrows(ResponseStatusException.class, () -> service.login("admin", "wrong", IP));
        }
        service.login("admin", "correct", IP);

        for (int i = 0; i < 4; i++) {
            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> service.login("admin", "wrong", IP));
            assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
        }
    }

    @Test
    void lockoutKeyIsCaseInsensitive() {
        seedUser();
        for (int i = 0; i < 5; i++) {
            assertThrows(ResponseStatusException.class, () -> service.login("ADMIN", "wrong", IP));
        }
        ResponseStatusException locked = assertThrows(ResponseStatusException.class,
                () -> service.login("admin", "correct", IP));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, locked.getStatusCode());
    }

    @Test
    void unknownUserStillRunsPasswordComparison() {
        PasswordEncoder spy = org.mockito.Mockito.spy(new BCryptPasswordEncoder());
        AuthService timed = new AuthService(users, spy, jwt);
        when(users.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> timed.login("ghost", "wrong", IP));
        verify(spy).matches(anyString(), anyString());
    }
}

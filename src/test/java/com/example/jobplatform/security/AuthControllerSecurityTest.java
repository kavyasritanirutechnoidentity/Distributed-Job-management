package com.example.jobplatform.security;

import com.example.jobplatform.controller.AuthController;
import com.example.jobplatform.dto.AuthResponse;
import com.example.jobplatform.entity.Role;
import com.example.jobplatform.service.AuthService;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
class AuthControllerSecurityTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void meWithoutTokenReturns401() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").isString());
    }

    @Test
    void meWithInvalidTokenReturns401() throws Exception {
        when(jwtService.parse(anyString())).thenThrow(new JwtException("bad token"));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer garbage"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meWithExpiredTokenReturns401() throws Exception {
        when(jwtService.parse(anyString())).thenThrow(new JwtException("expired"));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer expired.jwt.token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "admin", authorities = "ROLE_ADMIN")
    void meAsAdminReturnsAdminRole() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    @WithMockUser(username = "nani", authorities = "ROLE_VIEWER")
    void meAsViewerReturnsViewerRole() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("nani"))
                .andExpect(jsonPath("$.role").value("VIEWER"));
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    void responsesIncludeSecurityHeaders() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy",
                        containsString("default-src 'none'")))
                .andExpect(header().string("Referrer-Policy", "no-referrer"));
    }

    @Test
    void registerStaysPublic() throws Exception {
        when(authService.register(anyString(), anyString()))
                .thenReturn(new AuthResponse("token", "nani", Role.VIEWER));
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"nani\",\"password\":\"Passw0rd1\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("token"))
                .andExpect(jsonPath("$.role").value("VIEWER"));
    }

    @Test
    void loginStaysPublic() throws Exception {
        when(authService.login(anyString(), anyString(), anyString()))
                .thenReturn(new AuthResponse("token", "admin", Role.ADMIN));
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("token"));
    }

    @Test
    @WithMockUser(authorities = "ROLE_VIEWER")
    void viewerCannotPostJobs() throws Exception {
        mvc.perform(post("/api/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").isString());
    }
}

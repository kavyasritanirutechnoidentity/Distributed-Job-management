package com.example.jobplatform.service;

import com.example.jobplatform.activity.HealthCheckActivityImpl;
import com.sun.net.httpserver.HttpServer;
import io.temporal.failure.ApplicationFailure;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HealthCheckActivityTest {
    @Test
    void connectionUsesThePublicOnlyDnsResolver() throws Exception {
        var policy = mock(TargetUrlPolicy.class);
        String url = "http://verification.invalid/check";
        when(policy.validate(url)).thenReturn(URI.create(url));
        when(policy.resolvePublicHost("verification.invalid")).thenThrow(new UnknownHostException("blocked"));
        var activity = new HealthCheckActivityImpl(policy);
        try {
            assertThrows(ApplicationFailure.class, () -> activity.check(url));
            verify(policy).resolvePublicHost("verification.invalid");
        } finally {
            activity.close();
        }
    }

    @Test
    void redirectsAreNotFollowedAndServerFailuresAreRetryable() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var redirected = new AtomicInteger();
        server.createContext("/redirect", exchange -> {
            exchange.getResponseHeaders().add("Location", "/destination");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/destination", exchange -> {
            redirected.incrementAndGet();
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.createContext("/unhealthy", exchange -> {
            exchange.sendResponseHeaders(503, -1);
            exchange.close();
        });
        server.start();
        var policy = mock(TargetUrlPolicy.class);
        when(policy.validate(anyString())).thenAnswer(call -> URI.create(call.getArgument(0)));
        when(policy.resolvePublicHost("127.0.0.1"))
                .thenReturn(new java.net.InetAddress[]{java.net.InetAddress.getByName("127.0.0.1")});
        var activity = new HealthCheckActivityImpl(policy);
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        try {
            assertFalse(activity.check(base + "/redirect").healthy());
            assertEquals(0, redirected.get());
            var failure = assertThrows(ApplicationFailure.class, () -> activity.check(base + "/unhealthy"));
            assertEquals("TargetTemporarilyUnhealthy", failure.getType());
            assertFalse(failure.isNonRetryable());
        } finally {
            activity.close();
            server.stop(0);
        }
    }

    @Test
    void disallowedTargetsFailWithoutSendingARequest() throws Exception {
        var activity = new HealthCheckActivityImpl(new TargetUrlPolicy());
        try {
            var failure = assertThrows(ApplicationFailure.class, () -> activity.check("http://127.0.0.1/"));
            assertEquals("TargetNotAllowed", failure.getType());
            assertTrue(failure.isNonRetryable());
        } finally {
            activity.close();
        }
    }
}

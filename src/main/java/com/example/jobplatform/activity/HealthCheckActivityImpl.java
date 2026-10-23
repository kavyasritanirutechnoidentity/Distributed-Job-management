package com.example.jobplatform.activity;

import io.temporal.failure.ApplicationFailure;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
public class HealthCheckActivityImpl implements HealthCheckActivity {

    private static final Logger log = LoggerFactory.getLogger(HealthCheckActivityImpl.class);

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(REQUEST_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    @Override
    public HealthCheckResult check(String targetUrl) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(targetUrl))
                .timeout(REQUEST_TIMEOUT)
                .GET()
                .build();
        try {
            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            int status = response.statusCode();
            log.info("Health check {} -> HTTP {}", targetUrl, status);
            return new HealthCheckResult(status, status < 400, "HTTP " + status);
        } catch (IOException e) {
            log.warn("Health check {} unreachable: {}", targetUrl, e.getMessage());
            throw ApplicationFailure.newFailure("target unreachable: " + e.getMessage(), "TargetUnreachable");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw ApplicationFailure.newFailure("interrupted", "Interrupted");
        }
    }
}

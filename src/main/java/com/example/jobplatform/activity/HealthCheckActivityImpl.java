package com.example.jobplatform.activity;

import com.example.jobplatform.service.TargetUrlPolicy;
import io.temporal.failure.ApplicationFailure;
import jakarta.annotation.PreDestroy;
import org.apache.hc.client5.http.SystemDefaultDnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

@Component
public class HealthCheckActivityImpl implements HealthCheckActivity {
    private static final Logger log = LoggerFactory.getLogger(HealthCheckActivityImpl.class);
    private final TargetUrlPolicy targetUrlPolicy;
    private final CloseableHttpClient httpClient;

    public HealthCheckActivityImpl(TargetUrlPolicy targetUrlPolicy) {
        this.targetUrlPolicy = targetUrlPolicy;
        var connections = PoolingHttpClientConnectionManagerBuilder.create()
                .setDnsResolver(new SystemDefaultDnsResolver() {
                    @Override
                    public InetAddress[] resolve(String host) throws UnknownHostException {
                        return targetUrlPolicy.resolvePublicHost(host);
                    }
                })
                .setDefaultConnectionConfig(ConnectionConfig.custom()
                        .setConnectTimeout(Timeout.ofSeconds(10))
                        .setSocketTimeout(Timeout.ofSeconds(10)).build())
                .build();
        httpClient = HttpClients.custom().setConnectionManager(connections)
                .disableRedirectHandling().disableAutomaticRetries()
                .setDefaultRequestConfig(RequestConfig.custom()
                        .setConnectionRequestTimeout(Timeout.ofSeconds(10))
                        .setResponseTimeout(Timeout.ofSeconds(10)).build())
                .build();
    }

    @Override
    public HealthCheckResult check(String targetUrl) {
        URI uri;
        try {
            uri = targetUrlPolicy.validate(targetUrl);
        } catch (IllegalArgumentException e) {
            throw ApplicationFailure.newNonRetryableFailure(e.getMessage(), "TargetNotAllowed");
        }
        try {
            return httpClient.execute(new HttpGet(uri), response -> {
                int status = response.getCode();
                log.info("Health check host {} -> HTTP {}", uri.getHost(), status);
                if (status >= 500 || status == 429) {
                    throw ApplicationFailure.newFailure("HTTP " + status, "TargetTemporarilyUnhealthy");
                }
                return new HealthCheckResult(status, status >= 200 && status < 300, "HTTP " + status);
            });
        } catch (IOException e) {
            if (e instanceof UnknownHostException && e.getMessage() != null
                    && e.getMessage().contains("public internet")) {
                log.warn("Health check host {} resolved to a non-public address", uri.getHost());
                throw ApplicationFailure.newNonRetryableFailure(e.getMessage(), "TargetNotAllowed");
            }
            log.warn("Health check host {} unreachable ({})", uri.getHost(), e.getClass().getSimpleName());
            throw ApplicationFailure.newFailure("Target unreachable", "TargetUnreachable");
        }
    }

    @PreDestroy
    public void close() throws IOException {
        httpClient.close();
    }
}

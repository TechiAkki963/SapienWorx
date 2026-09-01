package com.sapienworx.api.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/** Fails startup instead of silently running production with development security settings. */
@Component
@Profile("prod")
public class ProductionSafetyValidator {
    private final Environment environment;
    private final boolean secureCookie;
    private final String allowedOrigins;
    private final String queueProvider;
    private final String storageType;
    private final boolean requireCleanScanTag;

    public ProductionSafetyValidator(
            Environment environment,
            @Value("${app.security.cookie.secure}") boolean secureCookie,
            @Value("${app.security.cors.allowed-origins}") String allowedOrigins,
            @Value("${app.queue.provider}") String queueProvider,
            @Value("${app.cv-storage.type}") String storageType,
            @Value("${app.cv-storage.s3.require-clean-scan-tag}") boolean requireCleanScanTag
    ) {
        this.environment = environment;
        this.secureCookie = secureCookie;
        this.allowedOrigins = allowedOrigins;
        this.queueProvider = queueProvider;
        this.storageType = storageType;
        this.requireCleanScanTag = requireCleanScanTag;
    }

    @PostConstruct
    void validate() {
        if (Arrays.asList(environment.getActiveProfiles()).contains("qa")) {
            fail("The qa and prod profiles must never be active together.");
        }
        if (!secureCookie) fail("Secure authentication cookies are mandatory in production.");
        if (allowedOrigins.contains("localhost") || allowedOrigins.contains("*")) {
            fail("Production CORS must contain only explicit HTTPS origins.");
        }
        if (!Arrays.stream(allowedOrigins.split(",")).map(String::trim).allMatch(value -> value.startsWith("https://"))) {
            fail("Every production CORS origin must use HTTPS.");
        }
        if (!"sqs".equalsIgnoreCase(queueProvider)) fail("Production background queues must use SQS.");
        if (!"s3".equalsIgnoreCase(storageType)) fail("Production CV storage must use S3.");
        if (!requireCleanScanTag) fail("Production CV access must require the GuardDuty clean-scan tag.");
    }

    private void fail(String message) { throw new IllegalStateException("Unsafe production configuration: " + message); }
}

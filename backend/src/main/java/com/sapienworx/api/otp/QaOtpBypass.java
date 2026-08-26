package com.sapienworx.api.otp;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Explicitly opt-in OTP shortcut for the isolated QA profile. It is not loaded
 * by the normal application, development, staging, or production profiles.
 */
@Component
@Profile("qa")
@ConditionalOnProperty(prefix = "app.qa.otp-bypass", name = "enabled", havingValue = "true")
class QaOtpBypass {

    private final byte[] configuredCode;

    QaOtpBypass(@Value("${app.qa.otp-bypass.code}") String code) {
        if (code == null || !code.matches("\\d{6}")) {
            throw new IllegalStateException("The QA OTP bypass code must be exactly six digits.");
        }
        configuredCode = code.getBytes(StandardCharsets.US_ASCII);
    }

    boolean matches(String submittedCode) {
        return submittedCode != null && MessageDigest.isEqual(
                configuredCode,
                submittedCode.getBytes(StandardCharsets.US_ASCII)
        );
    }
}

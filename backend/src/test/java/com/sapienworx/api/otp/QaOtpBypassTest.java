package com.sapienworx.api.otp;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class QaOtpBypassTest {

    @Test
    void acceptsOnlyTheConfiguredSixDigitCode() {
        QaOtpBypass bypass = new QaOtpBypass("999999");

        assertThat(bypass.matches("999999")).isTrue();
        assertThat(bypass.matches("000000")).isFalse();
        assertThat(bypass.matches(null)).isFalse();
    }

    @Test
    void rejectsAnUnsafeConfiguration() {
        assertThatThrownBy(() -> new QaOtpBypass("not-a-code"))
                .isInstanceOf(IllegalStateException.class);
    }
}

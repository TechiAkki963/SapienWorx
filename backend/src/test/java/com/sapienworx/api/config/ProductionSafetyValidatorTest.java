package com.sapienworx.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionSafetyValidatorTest {
    @Test
    void rejectsQaProfileInProduction() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod", "qa");
        ProductionSafetyValidator validator = new ProductionSafetyValidator(
                environment, true, "https://www.sapienworx.com", "sqs", "s3", true);
        assertThatThrownBy(validator::validate).hasMessageContaining("qa and prod");
    }

    @Test
    void rejectsLocalhostCorsInProduction() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        ProductionSafetyValidator validator = new ProductionSafetyValidator(
                environment, true, "http://localhost:3000", "sqs", "s3", true);
        assertThatThrownBy(validator::validate).hasMessageContaining("CORS");
    }

    @Test
    void acceptsTheProductionBaseline() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        new ProductionSafetyValidator(environment, true, "https://www.sapienworx.com", "sqs", "s3", true).validate();
    }
}

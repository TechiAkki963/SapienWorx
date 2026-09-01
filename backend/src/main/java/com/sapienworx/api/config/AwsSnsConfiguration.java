package com.sapienworx.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sns.SnsClient;

import java.time.Duration;

@Configuration
@ConditionalOnProperty(name = "app.workers.otp-mobile-enabled", havingValue = "true")
public class AwsSnsConfiguration {
    @Bean
    SnsClient snsClient(@Value("${app.aws.region}") String region) {
        return SnsClient.builder().region(Region.of(region)).credentialsProvider(DefaultCredentialsProvider.builder().build())
                .overrideConfiguration(ClientOverrideConfiguration.builder()
                        .apiCallAttemptTimeout(Duration.ofSeconds(10))
                        .apiCallTimeout(Duration.ofSeconds(15)).build())
                .build();
    }
}

package com.sapienworx.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.time.Duration;

@Configuration
@ConditionalOnProperty(name = "app.cv-storage.type", havingValue = "s3")
public class AwsS3Configuration {
    @Bean
    S3Client s3Client(@Value("${app.aws.region}") String region) {
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.builder().build())
                .overrideConfiguration(ClientOverrideConfiguration.builder()
                        .apiCallAttemptTimeout(Duration.ofSeconds(60))
                        .apiCallTimeout(Duration.ofSeconds(90)).build())
                .build();
    }
}

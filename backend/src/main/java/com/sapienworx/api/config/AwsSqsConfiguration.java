package com.sapienworx.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sqs.SqsClient;

import java.time.Duration;

@Configuration
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "sqs")
public class AwsSqsConfiguration {
    @Bean
    SqsClient sqsClient(@Value("${app.aws.region}") String region) {
        return SqsClient.builder().region(Region.of(region)).credentialsProvider(DefaultCredentialsProvider.builder().build())
                .overrideConfiguration(ClientOverrideConfiguration.builder()
                        .apiCallAttemptTimeout(Duration.ofSeconds(25))
                        .apiCallTimeout(Duration.ofSeconds(35)).build())
                .build();
    }
}

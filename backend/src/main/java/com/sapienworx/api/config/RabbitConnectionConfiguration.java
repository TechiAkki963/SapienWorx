package com.sapienworx.api.config;

import java.net.URI;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/**
 * Creates the single AMQP connection factory used by CV parsing, OTP dispatch,
 * and communication workers. Keeping credentials separate from the broker
 * address works consistently for Docker and local development.
 */
@Configuration
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "rabbitmq", matchIfMissing = true)
public class RabbitConnectionConfiguration {

    @Bean
    CachingConnectionFactory rabbitConnectionFactory(
            @Value("${spring.rabbitmq.addresses}") String addresses,
            @Value("${spring.rabbitmq.username}") String username,
            @Value("${spring.rabbitmq.password}") String password,
            @Value("${spring.rabbitmq.virtual-host:/}") String virtualHost) {
        URI address = URI.create(addresses.startsWith("amqp://") || addresses.startsWith("amqps://")
                ? addresses.split(",")[0].trim()
                : "amqp://" + addresses.split(",")[0].trim());
        CachingConnectionFactory connectionFactory = new CachingConnectionFactory(
                address.getHost(), address.getPort() == -1 ? 5672 : address.getPort());
        connectionFactory.setUsername(username);
        connectionFactory.setPassword(password);
        connectionFactory.setVirtualHost(virtualHost);
        if ("amqps".equalsIgnoreCase(address.getScheme())) {
            try { connectionFactory.getRabbitConnectionFactory().useSslProtocol(); }
            catch (Exception exception) { throw new IllegalStateException("AMQPS was configured but TLS could not be enabled.", exception); }
        }
        return connectionFactory;
    }
}

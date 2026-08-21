package com.sapienworx.api.communication;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/** Opt-in live-broker verification; it declares topology but sends no email payloads. */
@EnabledIfEnvironmentVariable(named = "RUN_RABBITMQ_INTEGRATION_TEST", matches = "true")
class RabbitMqCommunicationTopologyIntegrationTest {

    private CachingConnectionFactory connectionFactory;

    @AfterEach
    void closeConnectionFactory() {
        if (connectionFactory != null) {
            connectionFactory.destroy();
        }
    }

    @Test
    void declaresDedicatedEmailWorkAndDeadLetterQueues() {
        connectionFactory = new CachingConnectionFactory(System.getenv().getOrDefault("RABBITMQ_HOST", "localhost"));
        connectionFactory.setPort(Integer.parseInt(System.getenv().getOrDefault("RABBITMQ_PORT", "5672")));
        connectionFactory.setUsername(System.getenv().getOrDefault("RABBITMQ_USERNAME", "guest"));
        connectionFactory.setPassword(System.getenv().getOrDefault("RABBITMQ_PASSWORD", "guest"));

        RabbitMqCommunicationConfig configuration = new RabbitMqCommunicationConfig();
        DirectExchange exchange = configuration.emailDispatchExchange();
        Queue workQueue = configuration.emailDispatchQueue();
        Queue deadLetterQueue = configuration.emailDispatchDeadLetterQueue();
        RabbitAdmin rabbitAdmin = new RabbitAdmin(connectionFactory);

        rabbitAdmin.declareExchange(exchange);
        rabbitAdmin.declareQueue(workQueue);
        rabbitAdmin.declareQueue(deadLetterQueue);
        rabbitAdmin.declareBinding(configuration.emailDispatchBinding(workQueue, exchange));
        rabbitAdmin.declareBinding(configuration.emailDispatchDeadLetterBinding(deadLetterQueue, exchange));

        assertQueueExists(rabbitAdmin, RabbitMqCommunicationConfig.EMAIL_QUEUE);
        assertQueueExists(rabbitAdmin, RabbitMqCommunicationConfig.EMAIL_DEAD_LETTER_QUEUE);
    }

    private void assertQueueExists(RabbitAdmin rabbitAdmin, String queueName) {
        Properties properties = rabbitAdmin.getQueueProperties(queueName);
        assertThat(properties).as("queue %s should be declared", queueName).isNotNull();
    }
}

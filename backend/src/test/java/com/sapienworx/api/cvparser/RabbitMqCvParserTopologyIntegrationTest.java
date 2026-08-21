package com.sapienworx.api.cvparser;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Opt-in live-broker verification. Run with RUN_RABBITMQ_INTEGRATION_TEST=true.
 * It declares the durable production topology but never publishes CV payloads.
 */
@EnabledIfEnvironmentVariable(named = "RUN_RABBITMQ_INTEGRATION_TEST", matches = "true")
class RabbitMqCvParserTopologyIntegrationTest {

    private CachingConnectionFactory connectionFactory;

    @AfterEach
    void closeConnectionFactory() {
        if (connectionFactory != null) {
            connectionFactory.destroy();
        }
    }

    @Test
    void declaresCandidateBulkAndDeadLetterQueues() {
        connectionFactory = new CachingConnectionFactory(System.getenv().getOrDefault("RABBITMQ_HOST", "localhost"));
        connectionFactory.setPort(Integer.parseInt(System.getenv().getOrDefault("RABBITMQ_PORT", "5672")));
        connectionFactory.setUsername(System.getenv().getOrDefault("RABBITMQ_USERNAME", "guest"));
        connectionFactory.setPassword(System.getenv().getOrDefault("RABBITMQ_PASSWORD", "guest"));

        RabbitMqCvParserConfig configuration = new RabbitMqCvParserConfig();
        DirectExchange exchange = configuration.cvParserExchange();
        Queue candidateQueue = configuration.cvParserCandidateQueue();
        Queue bulkQueue = configuration.cvParserBulkQueue();
        Queue deadLetterQueue = configuration.cvParserDeadLetterQueue();
        RabbitAdmin rabbitAdmin = new RabbitAdmin(connectionFactory);

        rabbitAdmin.declareExchange(exchange);
        rabbitAdmin.declareQueue(candidateQueue);
        rabbitAdmin.declareQueue(bulkQueue);
        rabbitAdmin.declareQueue(deadLetterQueue);
        rabbitAdmin.declareBinding(configuration.candidateParserBinding(candidateQueue, exchange));
        rabbitAdmin.declareBinding(configuration.bulkParserBinding(bulkQueue, exchange));
        rabbitAdmin.declareBinding(configuration.parserDeadLetterBinding(deadLetterQueue, exchange));

        assertQueueExists(rabbitAdmin, RabbitMqCvParserConfig.CANDIDATE_QUEUE);
        assertQueueExists(rabbitAdmin, RabbitMqCvParserConfig.BULK_QUEUE);
        assertQueueExists(rabbitAdmin, RabbitMqCvParserConfig.DEAD_LETTER_QUEUE);
    }

    private void assertQueueExists(RabbitAdmin rabbitAdmin, String queueName) {
        Properties properties = rabbitAdmin.getQueueProperties(queueName);
        assertThat(properties).as("queue %s should be declared", queueName).isNotNull();
    }
}

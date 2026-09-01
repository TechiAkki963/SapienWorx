package com.sapienworx.api.cvparser;

import org.aopalliance.aop.Advice;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.config.RetryInterceptorBuilder;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.beans.factory.annotation.Qualifier;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@Configuration
@EnableRabbit
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "rabbitmq", matchIfMissing = true)
public class RabbitMqCvParserConfig {

    public static final String EXCHANGE_NAME = "cv.parser.exchange";
    public static final String CANDIDATE_QUEUE = "cv.parser.candidate.queue";
    public static final String BULK_QUEUE = "cv.parser.bulk.queue";
    public static final String DEAD_LETTER_QUEUE = "cv.parser.dlq";
    public static final String CANDIDATE_ROUTING_KEY = "parse.candidate";
    public static final String BULK_ROUTING_KEY = "parse.bulk";
    public static final String DEAD_LETTER_ROUTING_KEY = "parse.dlq";

    @Bean
    DirectExchange cvParserExchange() {
        return new DirectExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    Queue cvParserDeadLetterQueue() {
        return QueueBuilder.durable(DEAD_LETTER_QUEUE).build();
    }

    @Bean
    Queue cvParserCandidateQueue() {
        return primaryQueue(CANDIDATE_QUEUE);
    }

    @Bean
    Queue cvParserBulkQueue() {
        return primaryQueue(BULK_QUEUE);
    }

    @Bean
    Binding candidateParserBinding(
            @Qualifier("cvParserCandidateQueue") Queue cvParserCandidateQueue,
            DirectExchange cvParserExchange
    ) {
        return BindingBuilder.bind(cvParserCandidateQueue).to(cvParserExchange).with(CANDIDATE_ROUTING_KEY);
    }

    @Bean
    Binding bulkParserBinding(
            @Qualifier("cvParserBulkQueue") Queue cvParserBulkQueue,
            DirectExchange cvParserExchange
    ) {
        return BindingBuilder.bind(cvParserBulkQueue).to(cvParserExchange).with(BULK_ROUTING_KEY);
    }

    @Bean
    Binding parserDeadLetterBinding(
            @Qualifier("cvParserDeadLetterQueue") Queue cvParserDeadLetterQueue,
            DirectExchange cvParserExchange
    ) {
        return BindingBuilder.bind(cvParserDeadLetterQueue).to(cvParserExchange).with(DEAD_LETTER_ROUTING_KEY);
    }

    @Bean
    Jackson2JsonMessageConverter rabbitMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    SimpleRabbitListenerContainerFactory cvParserRabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            Jackson2JsonMessageConverter rabbitMessageConverter,
            CvParserTerminalFailureRecoverer cvParserTerminalFailureRecoverer
    ) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(rabbitMessageConverter);
        factory.setDefaultRequeueRejected(false);
        factory.setAdviceChain(retryAdvice(cvParserTerminalFailureRecoverer));
        return factory;
    }

    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, Jackson2JsonMessageConverter rabbitMessageConverter) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(rabbitMessageConverter);
        rabbitTemplate.setMandatory(true);
        return rabbitTemplate;
    }

    @Bean
    CvParserTerminalFailureRecoverer cvParserTerminalFailureRecoverer(
            ObjectMapper objectMapper,
            org.springframework.beans.factory.ObjectProvider<CvParsingEventPublisher> eventPublisherProvider
    ) {
        return new CvParserTerminalFailureRecoverer(objectMapper, eventPublisherProvider);
    }

    private Queue primaryQueue(String name) {
        return QueueBuilder.durable(name)
                .withArgument("x-dead-letter-exchange", EXCHANGE_NAME)
                .withArgument("x-dead-letter-routing-key", DEAD_LETTER_ROUTING_KEY)
                .build();
    }

    private Advice retryAdvice(CvParserTerminalFailureRecoverer cvParserTerminalFailureRecoverer) {
        return RetryInterceptorBuilder.stateless()
                .maxAttempts(3)
                .recoverer(cvParserTerminalFailureRecoverer)
                .build();
    }
}

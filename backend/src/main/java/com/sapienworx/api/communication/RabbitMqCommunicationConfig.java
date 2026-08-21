package com.sapienworx.api.communication;

import org.aopalliance.aop.Advice;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.config.RetryInterceptorBuilder;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.retry.RejectAndDontRequeueRecoverer;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Dedicated topology keeps delivery failures isolated from CV parser work. */
@Configuration
public class RabbitMqCommunicationConfig {

    public static final String EMAIL_EXCHANGE = "communication.email.exchange";
    public static final String EMAIL_QUEUE = "email.bulk.queue";
    public static final String EMAIL_DEAD_LETTER_QUEUE = "email.bulk.dlq";
    public static final String EMAIL_ROUTING_KEY = "dispatch.email";
    public static final String EMAIL_DEAD_LETTER_ROUTING_KEY = "dispatch.email.dlq";

    @Bean
    DirectExchange emailDispatchExchange() {
        return new DirectExchange(EMAIL_EXCHANGE, true, false);
    }

    @Bean
    Queue emailDispatchQueue() {
        return QueueBuilder.durable(EMAIL_QUEUE)
                .withArgument("x-dead-letter-exchange", EMAIL_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", EMAIL_DEAD_LETTER_ROUTING_KEY)
                .build();
    }

    @Bean
    Queue emailDispatchDeadLetterQueue() {
        return QueueBuilder.durable(EMAIL_DEAD_LETTER_QUEUE).build();
    }

    @Bean
    Binding emailDispatchBinding(
            @Qualifier("emailDispatchQueue") Queue emailDispatchQueue,
            @Qualifier("emailDispatchExchange") DirectExchange emailDispatchExchange
    ) {
        return BindingBuilder.bind(emailDispatchQueue).to(emailDispatchExchange).with(EMAIL_ROUTING_KEY);
    }

    @Bean
    Binding emailDispatchDeadLetterBinding(
            @Qualifier("emailDispatchDeadLetterQueue") Queue emailDispatchDeadLetterQueue,
            @Qualifier("emailDispatchExchange") DirectExchange emailDispatchExchange
    ) {
        return BindingBuilder.bind(emailDispatchDeadLetterQueue).to(emailDispatchExchange).with(EMAIL_DEAD_LETTER_ROUTING_KEY);
    }

    @Bean
    SimpleRabbitListenerContainerFactory emailRabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            @Qualifier("rabbitMessageConverter") Jackson2JsonMessageConverter rabbitMessageConverter
    ) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(rabbitMessageConverter);
        factory.setDefaultRequeueRejected(false);
        factory.setAdviceChain(emailRetryAdvice());
        return factory;
    }

    private Advice emailRetryAdvice() {
        return RetryInterceptorBuilder.stateless()
                .maxAttempts(3)
                .recoverer(new RejectAndDontRequeueRecoverer())
                .build();
    }
}

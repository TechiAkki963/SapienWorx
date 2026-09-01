package com.sapienworx.api.otp;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/** Durable hand-off boundary for an SMS/email provider adapter. */
@Configuration
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "rabbitmq", matchIfMissing = true)
public class RabbitMqOtpConfig {
    public static final String EXCHANGE = "auth.otp.exchange";
    public static final String EMAIL_QUEUE = "auth.otp.email.queue";
    public static final String MOBILE_QUEUE = "auth.otp.mobile.queue";
    public static final String EMAIL_KEY = "otp.email";
    public static final String MOBILE_KEY = "otp.mobile";

    @Bean DirectExchange otpExchange() { return new DirectExchange(EXCHANGE, true, false); }
    // Keep queue declarations backward compatible with existing QA brokers.
    // OTP expiry is applied per message by RabbitBackgroundQueuePublisher.
    @Bean Queue otpEmailQueue() { return QueueBuilder.durable(EMAIL_QUEUE).build(); }
    @Bean Queue otpMobileQueue() { return QueueBuilder.durable(MOBILE_QUEUE).build(); }
    @Bean Binding otpEmailBinding(@Qualifier("otpEmailQueue") Queue otpEmailQueue,
                                  @Qualifier("otpExchange") DirectExchange otpExchange) {
        return BindingBuilder.bind(otpEmailQueue).to(otpExchange).with(EMAIL_KEY);
    }
    @Bean Binding otpMobileBinding(@Qualifier("otpMobileQueue") Queue otpMobileQueue,
                                   @Qualifier("otpExchange") DirectExchange otpExchange) {
        return BindingBuilder.bind(otpMobileQueue).to(otpExchange).with(MOBILE_KEY);
    }
}

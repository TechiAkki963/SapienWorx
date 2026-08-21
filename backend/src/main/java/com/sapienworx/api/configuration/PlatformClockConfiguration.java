package com.sapienworx.api.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class PlatformClockConfiguration {

    @Bean
    Clock platformClock() {
        return Clock.systemUTC();
    }
}

package com.sapienworx.api.events;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Enables lightweight keep-alive events for long-lived SSE connections. */
@Configuration
@EnableScheduling
public class SseConfiguration {
}

package com.sapienworx.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

// Authentication is explicitly handled by the OTP/JWT security configuration.
// Do not create an unused generated-password user alongside that flow.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class SapienworxApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(SapienworxApiApplication.class, args);
    }
}

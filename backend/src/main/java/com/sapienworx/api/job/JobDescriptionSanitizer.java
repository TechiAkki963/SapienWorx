package com.sapienworx.api.job;

import org.owasp.html.PolicyFactory;
import org.owasp.html.Sanitizers;
import org.springframework.stereotype.Component;

/** The editor stores only a deliberately small, safe rich-text subset. */
@Component
public class JobDescriptionSanitizer {
    private final PolicyFactory policy = Sanitizers.FORMATTING
            .and(Sanitizers.BLOCKS)
            .and(Sanitizers.LINKS);

    public String sanitize(String html) {
        if (html == null || html.isBlank()) {
            throw new IllegalArgumentException("Job description is required.");
        }
        String sanitized = policy.sanitize(html);
        if (sanitized.isBlank()) {
            throw new IllegalArgumentException("Job description does not contain permitted content.");
        }
        return sanitized;
    }
}

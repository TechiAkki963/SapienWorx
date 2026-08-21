package com.sapienworx.api.communication;

import java.time.Instant;
import java.util.UUID;

public record InmailTemplateResponse(UUID id, String name, String subject, String bodyHtml, Instant updatedAt) {
    static InmailTemplateResponse from(InmailTemplate template) { return new InmailTemplateResponse(template.getId(), template.getTemplateName(), template.getSubject(), template.getBodyHtml(), template.getUpdatedAt()); }
}

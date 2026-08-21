package com.sapienworx.api.communication;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InmailTemplateRequest(@NotBlank @Size(max = 160) String name, @NotBlank @Size(max = 250) String subject, @NotBlank @Size(max = 100_000) String bodyHtml) { }

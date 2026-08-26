package com.sapienworx.api.communication;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/** A bounded recruiter batch is queued as one private message per recipient. */
public record BulkEmailRequest(
        @NotEmpty @Size(max = 40) List<@NotNull UUID> candidateIds,
        @Size(max = 80) String jobId,
        @NotBlank @Size(max = 200) String subject,
        @NotBlank @Size(max = 10_000) String htmlContent
) {
}

package com.sapienworx.api.communication;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record MessageRequest(@NotNull UUID recipientId, UUID applicationId, @NotBlank @Size(max = 10_000) String body) { }

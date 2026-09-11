package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.PipelineStage;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record BulkPipelineStageRequest(
        @NotEmpty @Size(max = 100) List<@NotNull UUID> applicationIds,
        @NotNull PipelineStage stage
) { }

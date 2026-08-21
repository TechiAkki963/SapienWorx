package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.PipelineStage;
import jakarta.validation.constraints.NotNull;

public record PipelineStageRequest(@NotNull PipelineStage stage) { }

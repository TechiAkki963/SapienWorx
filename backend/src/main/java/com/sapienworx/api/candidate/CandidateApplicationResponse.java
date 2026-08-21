package com.sapienworx.api.candidate;

import com.sapienworx.api.application.PipelineStage;

import java.time.Instant;
import java.util.UUID;

public record CandidateApplicationResponse(UUID applicationId, String jobId, String title, String companyName, PipelineStage stage, Instant appliedAt, Instant updatedAt) { }

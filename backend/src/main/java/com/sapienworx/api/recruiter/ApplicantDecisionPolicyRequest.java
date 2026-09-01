package com.sapienworx.api.recruiter;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record ApplicantDecisionPolicyRequest(@Min(1) @Max(12) int requiredApprovals) { }

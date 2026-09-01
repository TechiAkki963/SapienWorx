package com.sapienworx.api.recruiter;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ApplicantAssignmentRequest(@NotNull UUID recruiterId) { }

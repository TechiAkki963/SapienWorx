package com.sapienworx.api.recruiter;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RecruiterNoteRequest(@NotBlank @Size(max = 10_000) String note) { }

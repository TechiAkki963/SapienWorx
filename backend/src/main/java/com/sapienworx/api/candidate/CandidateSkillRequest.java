package com.sapienworx.api.candidate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CandidateSkillRequest(
        @NotBlank @Size(max = 100) String skill,
        @Min(1) @Max(5) int rating,
        @Min(0) @Max(60) Integer yearsOfExperience,
        @Min(0) @Max(11) Integer experienceMonths,
        @Size(max = 80) String softwareVersion,
        @Min(1900) @Max(2200) Integer lastUsedYear
) {
}

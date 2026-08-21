package com.sapienworx.api.candidate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CandidateEducationRequest(
        @NotNull EducationLevel level,
        @NotBlank @Size(max = 180) String degreeName,
        @NotBlank @Size(max = 200) String institutionName,
        @Min(1900) @Max(2200) Integer graduationYear,
        @Size(max = 40) String grade
) {
}

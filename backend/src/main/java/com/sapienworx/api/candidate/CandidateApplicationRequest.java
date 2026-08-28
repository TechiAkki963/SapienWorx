package com.sapienworx.api.candidate;

import jakarta.validation.constraints.Size;

public record CandidateApplicationRequest(
        @Size(max = 10_000) String coverLetter,
        @Size(max = 48) String referralCode,
        @Size(max = 32) String source
) { }

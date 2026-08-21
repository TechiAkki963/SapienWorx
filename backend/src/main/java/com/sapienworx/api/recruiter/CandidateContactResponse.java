package com.sapienworx.api.recruiter;

import java.util.UUID;

public record CandidateContactResponse(UUID candidateId, ContactChannel channel, String value) { }

package com.sapienworx.api.cvparser;

/** A parse result is a proposal until the candidate reviews and confirms it. */
public enum CandidateParseStatus {
    REVIEW_REQUIRED,
    CONFIRMED,
    DISCARDED
}

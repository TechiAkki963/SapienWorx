package com.sapienworx.api.cvparser;

import java.util.List;

/**
 * Deterministic, review-only profile proposal. Fields remain null when their
 * required evidence is absent instead of being inferred from surrounding text.
 */
public record ParsedCandidateProfile(
        String fullName,
        String email,
        String mobile,
        String location,
        String headline,
        List<String> skills,
        List<ParsedExperience> experience,
        List<ParsedEducation> education,
        List<String> warnings,
        String parserVersion,
        String schemaVersion
) {
    public record ParsedExperience(String sourceLine, String dateRange) {
    }

    public record ParsedEducation(String level, String sourceLine) {
    }
}

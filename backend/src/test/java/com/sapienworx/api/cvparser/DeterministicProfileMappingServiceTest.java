package com.sapienworx.api.cvparser;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DeterministicProfileMappingServiceTest {

    private final DeterministicProfileMappingService parsingService =
            new DeterministicProfileMappingService("v1.0.0-deterministic");

    @Test
    void mapsOnlyExplicitlySupportedProfileFacts() {
        ParsedCandidateProfile profile = parsingService.parseRawText("""
                Aarav Sharma
                aarav.sharma@example.com | +91 98765 43210
                Location: Bengaluru
                Headline: Senior Java Engineer
                Skills: Java, Spring Boot, PostgreSQL, React, Docker

                EXPERIENCE
                Senior Engineer | Example Systems | Jan 2021 - Present

                EDUCATION
                B.Tech Computer Science, Example Institute, 2020
                """);

        assertThat(profile.fullName()).isEqualTo("Aarav Sharma");
        assertThat(profile.email()).isEqualTo("aarav.sharma@example.com");
        assertThat(profile.mobile()).isEqualTo("+919876543210");
        assertThat(profile.location()).isEqualTo("Bengaluru");
        assertThat(profile.headline()).isEqualTo("Senior Java Engineer");
        assertThat(profile.skills()).containsExactly("Java", "Spring Boot", "React", "PostgreSQL", "Docker");
        assertThat(profile.experience()).singleElement()
                .extracting(ParsedCandidateProfile.ParsedExperience::dateRange)
                .isEqualTo("Jan 2021 - Present");
        assertThat(profile.education()).singleElement()
                .extracting(ParsedCandidateProfile.ParsedEducation::level)
                .isEqualTo("BACHELORS");
        assertThat(profile.warnings()).isEmpty();
    }

    @Test
    void warnsInsteadOfInventingMissingDetails() {
        ParsedCandidateProfile profile = parsingService.parseRawText("A short biography without structured CV fields.");

        assertThat(profile.email()).isNull();
        assertThat(profile.mobile()).isNull();
        assertThat(profile.location()).isNull();
        assertThat(profile.warnings()).contains(
                "Email address not found. Please enter it manually.",
                "Mobile number not found. Please enter it manually.",
                "Location not found. Please enter it manually."
        );
    }
}

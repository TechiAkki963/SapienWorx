package com.sapienworx.api.cvparser;

import com.fasterxml.jackson.databind.JsonNode;
import com.sapienworx.api.candidate.Candidate;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/** Versioned parser output. It contains no raw document text and is append-only. */
@Entity
@Immutable
@Table(
        name = "candidate_parse_results",
        uniqueConstraints = @UniqueConstraint(name = "uk_candidate_parse_results_request", columnNames = "request_id")
)
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class CandidateParseResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @Column(name = "request_id", nullable = false, updatable = false)
    private UUID requestId;

    @Column(name = "source_file_key", nullable = false, updatable = false, length = 1024)
    private String sourceFileKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 32)
    private CandidateParseStatus status;

    @Column(name = "parser_version", nullable = false, updatable = false, length = 80)
    private String parserVersion;

    @Column(name = "schema_version", nullable = false, updatable = false, length = 80)
    private String schemaVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parsed_profile", nullable = false, updatable = false, columnDefinition = "jsonb")
    private JsonNode parsedProfile;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, updatable = false, columnDefinition = "jsonb")
    private JsonNode warnings;

    @Column(name = "processing_duration_millis", nullable = false, updatable = false)
    private long processingDurationMillis;

    @CreationTimestamp
    @Column(name = "processed_at", nullable = false, updatable = false)
    private Instant processedAt;
}

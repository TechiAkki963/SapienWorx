package com.sapienworx.api.cvparser;

import java.time.Instant;
import java.util.UUID;

/**
 * Queue payload only: the file remains in object storage and is referenced by
 * fileKey. Do not place CV content or personal contact data in RabbitMQ.
 */
public record ParserPayload(
        UUID requestId,
        CvParserMessageType type,
        UUID candidateId,
        String jobId,
        String fileKey,
        String documentContentType,
        Instant requestedAt
) {
    public static ParserPayload candidate(UUID candidateId, String fileKey) {
        return candidate(candidateId, fileKey, null);
    }

    public static ParserPayload candidate(UUID candidateId, String fileKey, String documentContentType) {
        return new ParserPayload(UUID.randomUUID(), CvParserMessageType.CANDIDATE_ONBOARDING, candidateId, null, fileKey, documentContentType, Instant.now());
    }

    public static ParserPayload bulk(UUID candidateId, String jobId, String fileKey) {
        return bulk(candidateId, jobId, fileKey, null);
    }

    public static ParserPayload bulk(UUID candidateId, String jobId, String fileKey, String documentContentType) {
        return new ParserPayload(UUID.randomUUID(), CvParserMessageType.RECRUITER_BULK_UPLOAD, candidateId, jobId, fileKey, documentContentType, Instant.now());
    }
}

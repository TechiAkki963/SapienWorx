package com.sapienworx.api.cvparser;

/**
 * Storage and extraction boundary. Implement with S3-compatible file retrieval
 * plus deterministic PDFBox/Apache POI text extraction and JPA profile updates.
 */
public interface DeterministicCvParsingService {
    CvParsingOutcome parseAndPersist(ParserPayload payload);
}

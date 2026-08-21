package com.sapienworx.api.cvparser;

/** Adapter boundary for emitting CV_PARSING_COMPLETE / CV_PARSING_FAILED via SSE. */
public interface CvParsingEventPublisher {
    void publishCompleted(ParserPayload payload);
    void publishFailed(ParserPayload payload, String reason);
}

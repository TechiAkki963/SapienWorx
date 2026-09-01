package com.sapienworx.api.cvparser;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.sapienworx.api.queue.BackgroundQueuePublisher;
import com.sapienworx.api.queue.LogicalQueue;

/** Routes live candidate uploads separately from lower-priority recruiter bulk work. */
@Service
@RequiredArgsConstructor
public class CvParserMessagePublisher {

    private final BackgroundQueuePublisher queuePublisher;

    public void queueCandidateOnboarding(ParserPayload payload) {
        assertPayload(payload, CvParserMessageType.CANDIDATE_ONBOARDING);
        queuePublisher.send(LogicalQueue.CV_CANDIDATE, payload);
    }

    public void queueRecruiterBulkUpload(ParserPayload payload) {
        assertPayload(payload, CvParserMessageType.RECRUITER_BULK_UPLOAD);
        queuePublisher.send(LogicalQueue.CV_BULK, payload);
    }

    private void assertPayload(ParserPayload payload, CvParserMessageType expectedType) {
        if (payload == null || payload.type() != expectedType || payload.candidateId() == null || payload.fileKey() == null || payload.fileKey().isBlank()) {
            throw new IllegalArgumentException("Parser payload is incomplete or routed to the wrong queue.");
        }
        if (expectedType == CvParserMessageType.RECRUITER_BULK_UPLOAD && (payload.jobId() == null || payload.jobId().isBlank())) {
            throw new IllegalArgumentException("Bulk CV parsing requires a job ID.");
        }
    }
}

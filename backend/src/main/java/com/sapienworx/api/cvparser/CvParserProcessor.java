package com.sapienworx.api.cvparser;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnBean(DeterministicCvParsingService.class)
public class CvParserProcessor {
    private final ObjectProvider<DeterministicCvParsingService> parsingServiceProvider;
    private final ObjectProvider<CvParsingEventPublisher> eventPublisherProvider;

    public void process(ParserPayload payload, CvParserMessageType expectedType) {
        requireType(payload, expectedType);
        DeterministicCvParsingService parsingService = parsingServiceProvider.getIfAvailable();
        if (parsingService == null) throw new IllegalStateException("No deterministic CV parsing service is configured.");
        CvParsingOutcome outcome = parsingService.parseAndPersist(payload);
        eventPublisherProvider.ifAvailable(eventPublisher -> eventPublisher.publishCompleted(payload, outcome));
        log.info("CV parse request {} completed", payload.requestId());
    }

    private void requireType(ParserPayload payload, CvParserMessageType expectedType) {
        if (payload == null || payload.type() != expectedType || payload.candidateId() == null || payload.fileKey() == null || payload.fileKey().isBlank()) {
            throw new IllegalArgumentException("Invalid CV parser payload.");
        }
        if (expectedType == CvParserMessageType.RECRUITER_BULK_UPLOAD && (payload.jobId() == null || payload.jobId().isBlank())) {
            throw new IllegalArgumentException("Bulk parser payload requires a job ID.");
        }
    }
}

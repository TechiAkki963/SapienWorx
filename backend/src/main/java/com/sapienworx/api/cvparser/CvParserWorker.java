package com.sapienworx.api.cvparser;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

/**
 * A failed message is retried three times by the listener container. The
 * configured recoverer then rejects it without requeueing, causing RabbitMQ to
 * route it to cv.parser.dlq.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnBean(DeterministicCvParsingService.class)
public class CvParserWorker {

    private final ObjectProvider<DeterministicCvParsingService> parsingServiceProvider;
    private final ObjectProvider<CvParsingEventPublisher> eventPublisherProvider;

    @RabbitListener(
            queues = RabbitMqCvParserConfig.CANDIDATE_QUEUE,
            concurrency = "2-5",
            containerFactory = "cvParserRabbitListenerContainerFactory"
    )
    public void processCandidateCv(ParserPayload payload) {
        requireType(payload, CvParserMessageType.CANDIDATE_ONBOARDING);
        log.info("Processing high-priority CV parse request {} for candidate {}", payload.requestId(), payload.candidateId());
        process(payload);
    }

    @RabbitListener(
            queues = RabbitMqCvParserConfig.BULK_QUEUE,
            concurrency = "1-2",
            containerFactory = "cvParserRabbitListenerContainerFactory"
    )
    public void processBulkCv(ParserPayload payload) {
        requireType(payload, CvParserMessageType.RECRUITER_BULK_UPLOAD);
        log.info("Processing bulk CV parse request {} for job {}", payload.requestId(), payload.jobId());
        process(payload);
    }

    private void process(ParserPayload payload) {
        try {
            DeterministicCvParsingService parsingService = parsingServiceProvider.getIfAvailable();
            if (parsingService == null) {
                throw new IllegalStateException("No deterministic CV parsing service is configured.");
            }
            CvParsingOutcome outcome = parsingService.parseAndPersist(payload);
            eventPublisherProvider.ifAvailable(eventPublisher -> eventPublisher.publishCompleted(payload, outcome));
        } catch (RuntimeException exception) {
            log.warn("CV parse request {} failed; listener retry/DLQ policy will handle it", payload.requestId(), exception);
            throw exception;
        }
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

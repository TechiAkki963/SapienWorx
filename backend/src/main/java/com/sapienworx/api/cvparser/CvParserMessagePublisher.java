package com.sapienworx.api.cvparser;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

/** Routes live candidate uploads separately from lower-priority recruiter bulk work. */
@Service
@RequiredArgsConstructor
public class CvParserMessagePublisher {

    private final RabbitTemplate rabbitTemplate;

    public void queueCandidateOnboarding(ParserPayload payload) {
        assertPayload(payload, CvParserMessageType.CANDIDATE_ONBOARDING);
        rabbitTemplate.convertAndSend(
                RabbitMqCvParserConfig.EXCHANGE_NAME,
                RabbitMqCvParserConfig.CANDIDATE_ROUTING_KEY,
                payload
        );
    }

    public void queueRecruiterBulkUpload(ParserPayload payload) {
        assertPayload(payload, CvParserMessageType.RECRUITER_BULK_UPLOAD);
        rabbitTemplate.convertAndSend(
                RabbitMqCvParserConfig.EXCHANGE_NAME,
                RabbitMqCvParserConfig.BULK_ROUTING_KEY,
                payload
        );
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

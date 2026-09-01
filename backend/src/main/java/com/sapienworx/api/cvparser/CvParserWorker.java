package com.sapienworx.api.cvparser;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "rabbitmq", matchIfMissing = true)
public class CvParserWorker {
    private final CvParserProcessor processor;

    @RabbitListener(
            queues = RabbitMqCvParserConfig.CANDIDATE_QUEUE,
            concurrency = "2-5",
            containerFactory = "cvParserRabbitListenerContainerFactory"
    )
    public void processCandidateCv(ParserPayload payload) {
        log.info("Processing high-priority CV parse request {} for candidate {}", payload.requestId(), payload.candidateId());
        processor.process(payload, CvParserMessageType.CANDIDATE_ONBOARDING);
    }

    @RabbitListener(
            queues = RabbitMqCvParserConfig.BULK_QUEUE,
            concurrency = "1-2",
            containerFactory = "cvParserRabbitListenerContainerFactory"
    )
    public void processBulkCv(ParserPayload payload) {
        log.info("Processing bulk CV parse request {} for job {}", payload.requestId(), payload.jobId());
        processor.process(payload, CvParserMessageType.RECRUITER_BULK_UPLOAD);
    }
}

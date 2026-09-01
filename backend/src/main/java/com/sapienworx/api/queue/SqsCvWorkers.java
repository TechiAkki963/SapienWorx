package com.sapienworx.api.queue;

import com.sapienworx.api.cvparser.CvParserMessageType;
import com.sapienworx.api.cvparser.CvParserProcessor;
import com.sapienworx.api.cvparser.ParserPayload;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnExpression("'${app.queue.provider:rabbitmq}' == 'sqs' and ${app.workers.cv-enabled:true}")
public class SqsCvWorkers {
    private final SqsMessageConsumer consumer;
    private final CvParserProcessor processor;

    @Scheduled(fixedDelayString = "${app.workers.poll-delay:PT1S}")
    public void candidate() {
        consumer.poll(LogicalQueue.CV_CANDIDATE, ParserPayload.class,
                payload -> processor.process(payload, CvParserMessageType.CANDIDATE_ONBOARDING));
    }

    @Scheduled(fixedDelayString = "${app.workers.poll-delay:PT1S}")
    public void bulk() {
        consumer.poll(LogicalQueue.CV_BULK, ParserPayload.class,
                payload -> processor.process(payload, CvParserMessageType.RECRUITER_BULK_UPLOAD));
    }
}

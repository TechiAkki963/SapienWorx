package com.sapienworx.api.events;

import com.sapienworx.api.cvparser.CvParsingEventPublisher;
import com.sapienworx.api.cvparser.CvParsingOutcome;
import com.sapienworx.api.cvparser.ParserPayload;
import org.springframework.stereotype.Component;

/** Bridges asynchronous CV parser results into the candidate's authenticated SSE stream. */
@Component
public class SseCvParsingEventPublisher implements CvParsingEventPublisher {

    private final SseNotificationService notificationService;

    public SseCvParsingEventPublisher(SseNotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @Override
    public void publishCompleted(ParserPayload payload, CvParsingOutcome outcome) {
        notificationService.sendToUser(
                payload.candidateId(),
                "CV_PARSING_COMPLETE",
                CvParsingCompleteEvent.success(payload.candidateId(), outcome.parserVersion(), outcome.warnings())
        );
    }

    @Override
    public void publishFailed(ParserPayload payload, String reason) {
        notificationService.sendToUser(
                payload.candidateId(),
                "CV_PARSING_FAILED",
                CvParsingFailedEvent.failure(payload.candidateId(), "We could not finish reading this CV. Please try again.")
        );
    }
}

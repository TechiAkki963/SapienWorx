package com.sapienworx.api.communication;

import com.sapienworx.api.queue.BackgroundQueuePublisher;
import com.sapienworx.api.queue.LogicalQueue;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

/** Queues transactional system mail without returning email addresses or rendered content to an API client. */
@Service
@RequiredArgsConstructor
public class TransactionalEmailDispatchService {
    private final BackgroundQueuePublisher queuePublisher;

    public UUID queue(UUID recipientUserId, String recipientEmail, String jobId, String subject, String htmlContent) {
        return queue(recipientUserId, recipientEmail, jobId, subject, htmlContent, null, null);
    }

    public UUID queue(UUID recipientUserId, String recipientEmail, String jobId, String subject, String htmlContent,
                      String calendarFilename, String calendarContent) {
        UUID dispatchId = UUID.randomUUID();
        queuePublisher.send(LogicalQueue.EMAIL_BULK, new EmailDispatchPayload(dispatchId, recipientUserId, jobId,
                recipientEmail, subject, htmlContent, calendarFilename, calendarContent));
        return dispatchId;
    }
}

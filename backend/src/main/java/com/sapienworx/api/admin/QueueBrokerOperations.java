package com.sapienworx.api.admin;

import com.sapienworx.api.queue.LogicalQueue;

public interface QueueBrokerOperations {
    QueueBrokerState state(LogicalQueue queue);
    int retryOneCvFailure();
}

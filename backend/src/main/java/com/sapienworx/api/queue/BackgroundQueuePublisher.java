package com.sapienworx.api.queue;

public interface BackgroundQueuePublisher {
    void send(LogicalQueue queue, Object payload);
}

package com.sapienworx.api.queue;

public class QueueDeliveryInProgressException extends RuntimeException {
    public QueueDeliveryInProgressException(String message) {
        super(message);
    }
}

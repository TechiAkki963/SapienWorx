package com.sapienworx.api.admin;

public record QueueBrokerState(int messages, int consumers, boolean available, String provider) {
}

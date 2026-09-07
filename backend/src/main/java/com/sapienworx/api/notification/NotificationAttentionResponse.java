package com.sapienworx.api.notification;

/** Persisted attention counts used by workspace navigation after refresh or a new sign-in. */
public record NotificationAttentionResponse(long unreadNotifications, long unreadMessages, long unreadInterviews) { }

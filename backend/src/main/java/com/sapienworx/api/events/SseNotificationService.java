package com.sapienworx.api.events;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Holds a user's active browser streams in this application instance. Multiple
 * emitters are retained per user so separate tabs/devices do not disconnect
 * each other. Deployments with more than one API instance should fan events
 * out through a shared broker before calling this service on each instance.
 */
@Slf4j
@Service
public class SseNotificationService {

    private final Map<UUID, Set<SseEmitter>> emittersByUser = new ConcurrentHashMap<>();
    private final Duration streamTimeout;

    public SseNotificationService(@Value("${app.sse.timeout:PT30M}") Duration streamTimeout) {
        this.streamTimeout = streamTimeout;
    }

    public SseEmitter subscribe(UUID userId) {
        SseEmitter emitter = new SseEmitter(streamTimeout.toMillis());
        emittersByUser.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(userId, emitter));
        emitter.onTimeout(() -> removeEmitter(userId, emitter));
        emitter.onError(error -> removeEmitter(userId, emitter));

        sendToEmitter(userId, emitter, "CONNECTED", new ConnectionEvent("established", Instant.now()));
        return emitter;
    }

    public void publishPipelineUpdate(UUID recruiterUserId, PipelineUpdateEvent event) {
        sendToUser(recruiterUserId, "PIPELINE_UPDATE", event);
    }

    public void sendToUser(UUID userId, String eventName, Object payload) {
        Set<SseEmitter> emitters = emittersByUser.get(userId);
        if (emitters == null) {
            return;
        }

        emitters.forEach(emitter -> sendToEmitter(userId, emitter, eventName, payload));
    }

    @Scheduled(fixedDelayString = "${app.sse.heartbeat-interval:PT25S}")
    void sendHeartbeats() {
        Instant timestamp = Instant.now();
        emittersByUser.forEach((userId, emitters) ->
                emitters.forEach(emitter -> sendToEmitter(userId, emitter, "HEARTBEAT", new HeartbeatEvent(timestamp)))
        );
    }

    int activeConnectionCount(UUID userId) {
        return emittersByUser.getOrDefault(userId, Set.of()).size();
    }

    private void sendToEmitter(UUID userId, SseEmitter emitter, String eventName, Object payload) {
        try {
            synchronized (emitter) {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .reconnectTime(5_000)
                        .data(payload, MediaType.APPLICATION_JSON));
            }
        } catch (IOException | IllegalStateException exception) {
            log.debug("SSE stream became unavailable for user {}", userId);
            removeEmitter(userId, emitter);
        }
    }

    private void removeEmitter(UUID userId, SseEmitter emitter) {
        emittersByUser.computeIfPresent(userId, (ignored, emitters) -> {
            emitters.remove(emitter);
            return emitters.isEmpty() ? null : emitters;
        });
    }

    private record ConnectionEvent(String status, Instant timestamp) {
    }

    private record HeartbeatEvent(Instant timestamp) {
    }
}

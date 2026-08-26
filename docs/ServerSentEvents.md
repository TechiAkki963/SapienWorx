# Master Architecture Prompt: Server-Sent Events (SSE) Integration

**Objective:** Establish a robust, unidirectional Server-Sent Events (SSE) pipeline. The Spring Boot backend must push real-time JSON payloads to the Next.js frontend to notify candidates when their CV parsing is complete, and alert recruiters to live pipeline updates.

---

## 1. Spring Boot: The SSE Controller & Service

The backend team must utilise Spring's `SseEmitter` to hold HTTP connections open indefinitely, allowing the asynchronous RabbitMQ workers to broadcast events back to specific authenticated clients.

### The Emitter Registry Service

This service maintains a thread-safe map of active client connections.

\`\`\`java
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SseNotificationService {

    // Maps a User UUID to their active SseEmitter
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String userId) {
        // Set a generous timeout (e.g., 30 minutes) or 0L for infinite
        SseEmitter emitter = new SseEmitter(1800000L);
        emitters.put(userId, emitter);

        // Cleanup callbacks
        emitter.onCompletion(() -> emitters.remove(userId));
        emitter.onTimeout(() -> emitters.remove(userId));
        emitter.onError((e) -> emitters.remove(userId));

        // Dispatch an initial heartbeat connection event
        sendEvent(userId, "CONNECTED", "{\"status\":\"established\"}");
        return emitter;
    }

    public void sendEvent(String userId, String eventName, String jsonPayload) {
        SseEmitter emitter = emitters.get(userId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(jsonPayload));
            } catch (IOException e) {
                emitters.remove(userId);
            }
        }
    }

}
\`\`\`

### The Controller Endpoint

Expose an endpoint that the Next.js client will hit to open the stream.

\`\`\`java
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/events")
public class SseController {

    private final SseNotificationService sseService;

    public SseController(SseNotificationService sseService) {
        this.sseService = sseService;
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamEvents(/* Inject Authenticated Principal */) {
        // Retrieve the authenticated user's ID from the SecurityContext
        String userId = "extracted-uuid-from-jwt";
        return sseService.subscribe(userId);
    }

}
\`\`\`

---

## 2. Standardised JSON Payload Structures

The RabbitMQ worker will pass structured data to the `SseNotificationService`. The frontend team requires a predictable JSON schema to parse these incoming events.

**Event Name:** `CV_PARSING_COMPLETE`
\`\`\`json
{
"status": "SUCCESS",
"candidateId": "uuid-string",
"parserVersion": "v1.2.4",
"warnings": ["Missing certification dates"],
"timestamp": "2026-08-21T10:23:47Z"
}
\`\`\`

**Event Name:** `PIPELINE_UPDATE`
\`\`\`json
{
"jobId": "SWX_NT_001",
"candidateId": "uuid-string",
"previousStage": "Screening",
"newStage": "Interviewing",
"timestamp": "2026-08-21T10:23:47Z"
}
\`\`\`

---

## 3. Next.js Client: The EventSource Hook

The frontend team must implement a robust custom React hook to manage the `EventSource` connection, handle the browser's native reconnection logic, and dispatch the payloads into the global client state.

\`\`\`typescript
"use client";

import { useEffect } from "react";

export function useServerEvents() {
useEffect(() => {
// The EventSource automatically passes the HttpOnly authentication cookie
const eventSource = new EventSource("/api/events/stream", {
withCredentials: true
});

    // Listen for the CV Parser event
    eventSource.addEventListener("CV_PARSING_COMPLETE", (event) => {
      const data = JSON.parse(event.data);
      if (data.status === "SUCCESS") {
         // TODO: Dispatch to global state (Zustand) to trigger the Review UI
         console.log("CV successfully parsed:", data);
      }
    });

    // Listen for recruiter pipeline alerts
    eventSource.addEventListener("PIPELINE_UPDATE", (event) => {
      const data = JSON.parse(event.data);
      // TODO: Dispatch update to global state to increment dashboard badges
      console.log("Pipeline updated:", data);
    });

    // Error handling and cleanup
    eventSource.onerror = (error) => {
      console.error("SSE connection lost. Reconnecting...", error);
    };

    return () => {
      eventSource.close();
    };

}, []);
}
\`\`\`

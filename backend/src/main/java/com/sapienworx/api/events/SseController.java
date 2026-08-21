package com.sapienworx.api.events;

import com.sapienworx.api.security.AuthenticatedUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Authenticated, one-way event stream for candidate and recruiter updates. */
@RestController
@RequestMapping("/api/events")
public class SseController {

    private final SseNotificationService notificationService;

    public SseController(SseNotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal AuthenticatedUser currentUser) {
        if (currentUser == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required for event streaming.");
        }
        return notificationService.subscribe(currentUser.userId());
    }
}

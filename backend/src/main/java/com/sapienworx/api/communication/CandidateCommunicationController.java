package com.sapienworx.api.communication;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.PlatformRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/candidate/messages")
@RequiredArgsConstructor
public class CandidateCommunicationController {
    private final CommunicationService communicationService;
    @PostMapping public MessageResponse send(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody MessageRequest request) { return communicationService.send(candidateId(user), PlatformRole.CANDIDATE, request); }
    @GetMapping public Page<MessageResponse> conversation(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam UUID with, @RequestParam(defaultValue = "0") int page) { return communicationService.conversation(candidateId(user), with, PageRequest.of(Math.max(0, page), 50)); }
    private UUID candidateId(AuthenticatedUser user) { if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required."); return user.userId(); }
}

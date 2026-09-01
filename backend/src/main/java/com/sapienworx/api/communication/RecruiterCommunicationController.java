package com.sapienworx.api.communication;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.PlatformRole;
import com.sapienworx.api.web.ApiPageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/recruiter/communications")
@RequiredArgsConstructor
public class RecruiterCommunicationController {
    private final CommunicationService communicationService;
    private final RecruiterEmailDispatchService recruiterEmailDispatchService;
    @PostMapping("/messages") public MessageResponse send(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody MessageRequest request) { return communicationService.send(recruiterId(user), PlatformRole.RECRUITER, request); }
    @GetMapping("/messages") public ApiPageResponse<MessageResponse> conversation(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam UUID with, @RequestParam(defaultValue = "0") int page) { return ApiPageResponse.from(communicationService.conversation(recruiterId(user), with, PageRequest.of(Math.max(0, page), 50))); }
    @PostMapping("/templates") public InmailTemplateResponse saveTemplate(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody InmailTemplateRequest request) { return communicationService.saveTemplate(recruiterId(user), request); }
    @GetMapping("/templates") public List<InmailTemplateResponse> templates(@AuthenticationPrincipal AuthenticatedUser user) { return communicationService.templates(recruiterId(user)); }
    @PostMapping("/bulk-email") public List<UUID> bulkEmail(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody BulkEmailRequest request) {
        recruiterId(user);
        return request.candidateIds().stream().distinct()
                .map(candidateId -> recruiterEmailDispatchService.queueForCandidate(candidateId, new RecruiterEmailCommand(candidateId, request.jobId(), request.subject(), request.htmlContent())))
                .toList();
    }
    private UUID recruiterId(AuthenticatedUser user) { if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required."); return user.userId(); }
}

package com.sapienworx.api.recruiter;

import com.sapienworx.api.candidate.CandidateSourcingResult;
import com.sapienworx.api.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/recruiter")
@RequiredArgsConstructor
public class RecruiterOperationsController {
    private final RecruiterOperationsService operations;
    @GetMapping("/dashboard") public RecruiterDashboardResponse dashboard(@AuthenticationPrincipal AuthenticatedUser user) { return operations.dashboard(recruiterId(user)); }
    @GetMapping("/pipeline") public Page<PipelineCandidateResponse> pipeline(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam(required = false) com.sapienworx.api.application.PipelineStage stage, @RequestParam(defaultValue = "") String query, @RequestParam(defaultValue = "0") int page) { return operations.pipeline(recruiterId(user), stage, query, PageRequest.of(Math.max(0, page), 10)); }
    @PatchMapping("/pipeline/{applicationId}/stage") public PipelineCandidateResponse stage(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId, @Valid @RequestBody PipelineStageRequest request) { return operations.moveStage(recruiterId(user), applicationId, request.stage()); }
    @PostMapping("/pipeline/{applicationId}/notes") public PipelineCandidateResponse note(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId, @Valid @RequestBody RecruiterNoteRequest request) { return operations.addNote(recruiterId(user), applicationId, request.note()); }
    @GetMapping("/candidates/{candidateId}/contact") public CandidateContactResponse contact(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID candidateId, @RequestParam ContactChannel channel) { return operations.revealContact(recruiterId(user), candidateId, channel); }
    @PostMapping("/sourcing/search") public Page<CandidateSourcingResult> source(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody RecruiterSourcingRequest request) { return operations.source(recruiterId(user), request); }
    @PostMapping("/interviews") public RecruiterDashboardResponse.UpcomingInterview schedule(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody InterviewRequest request) { return operations.schedule(recruiterId(user), request); }
    private UUID recruiterId(AuthenticatedUser user) { if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required."); return user.userId(); }
}

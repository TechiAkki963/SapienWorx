package com.sapienworx.api.candidate;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.web.ApiPageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
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
import com.sapienworx.api.workflow.WorkflowRequests;
import com.sapienworx.api.workflow.WorkflowResponses;
import com.sapienworx.api.reporting.PortalReportService;
import java.util.Map;
import java.util.List;
import org.springframework.web.bind.annotation.ResponseStatus;

@RestController
@RequestMapping("/api/candidate")
@RequiredArgsConstructor
public class CandidateWorkspaceController {
    private final CandidateWorkspaceService candidateWorkspaceService;
    private final PortalReportService portalReportService;

    @GetMapping("/profile")
    public CandidateProfileResponse profile(@AuthenticationPrincipal AuthenticatedUser user) { return candidateWorkspaceService.profile(candidateId(user)); }
    @PatchMapping("/profile")
    public CandidateProfileResponse updateProfile(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody CandidateProfileRequest request) { return candidateWorkspaceService.updateProfile(candidateId(user), request); }
    @GetMapping("/dashboard")
    public CandidateDashboardResponse dashboard(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam(defaultValue = "90") int rangeDays) { return candidateWorkspaceService.dashboard(candidateId(user), rangeDays); }
    @GetMapping("/reports")
    public Map<String, Object> reports(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam(defaultValue = "90") int rangeDays) {
        return portalReportService.candidateReport(candidateId(user), rangeDays);
    }
    @GetMapping("/reports/export.csv")
    public ResponseEntity<String> exportReport(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam(defaultValue = "90") int rangeDays) {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=sapienworx-candidate-report.csv")
                .contentType(MediaType.parseMediaType("text/csv")).body(portalReportService.candidateCsv(candidateId(user), rangeDays));
    }
    @PostMapping("/jobs/{publicJobId}/applications")
    public CandidateApplicationResponse apply(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId, @Valid @RequestBody CandidateApplicationRequest request) { return candidateWorkspaceService.apply(candidateId(user), publicJobId, request); }
    @GetMapping("/applications")
    public ApiPageResponse<CandidateApplicationResponse> applications(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam(defaultValue = "0") int page) {
        return ApiPageResponse.from(candidateWorkspaceService.applications(candidateId(user), PageRequest.of(Math.max(0, page), 20, Sort.by(Sort.Direction.DESC, "updatedAt"))));
    }
    @GetMapping("/applications/summary")
    public CandidateApplicationSummaryResponse applicationSummary(@AuthenticationPrincipal AuthenticatedUser user) {
        return candidateWorkspaceService.applicationSummary(candidateId(user));
    }
    @GetMapping("/saved-jobs")
    public List<SavedJobResponse> savedJobs(@AuthenticationPrincipal AuthenticatedUser user) {
        return candidateWorkspaceService.savedJobs(candidateId(user));
    }
    @PostMapping("/saved-jobs/{publicJobId}")
    public SavedJobResponse saveJob(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId) {
        return candidateWorkspaceService.saveJob(candidateId(user), publicJobId);
    }
    @DeleteMapping("/saved-jobs/{publicJobId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeSavedJob(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId) {
        candidateWorkspaceService.removeSavedJob(candidateId(user), publicJobId);
    }
    @GetMapping("/applications/{applicationId}/timeline")
    public WorkflowResponses.ApplicationTimeline applicationTimeline(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId) {
        return candidateWorkspaceService.applicationTimeline(candidateId(user), applicationId);
    }
    @PostMapping("/jobs/{publicJobId}/referral")
    public WorkflowResponses.Referral createReferral(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId) {
        return candidateWorkspaceService.createReferral(candidateId(user), publicJobId);
    }
    @GetMapping("/privacy") public WorkflowResponses.CandidatePrivacy privacy(@AuthenticationPrincipal AuthenticatedUser user) { return candidateWorkspaceService.privacy(candidateId(user)); }
    @PatchMapping("/privacy") public WorkflowResponses.CandidatePrivacy updatePrivacy(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody WorkflowRequests.CandidatePrivacyUpdateRequest request) { return candidateWorkspaceService.updatePrivacy(candidateId(user), request); }
    @PostMapping("/privacy/data-export") public WorkflowResponses.CandidatePrivacy requestExport(@AuthenticationPrincipal AuthenticatedUser user) { return candidateWorkspaceService.requestDataExport(candidateId(user)); }
    @GetMapping("/privacy/data-export/download")
    public ResponseEntity<Map<String, Object>> downloadExport(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=sapienworx-personal-data.json")
                .contentType(MediaType.APPLICATION_JSON).body(candidateWorkspaceService.dataExport(candidateId(user)));
    }
    @PostMapping("/privacy/deletion-request") public WorkflowResponses.CandidatePrivacy requestDeletion(@AuthenticationPrincipal AuthenticatedUser user) { return candidateWorkspaceService.requestDeletion(candidateId(user)); }
    @DeleteMapping("/account")
    public ResponseEntity<WorkflowResponses.CandidatePrivacy> requestAccountErasure(@AuthenticationPrincipal AuthenticatedUser user) {
        // Erasure is intentionally asynchronous: the grace period allows identity confirmation,
        // legal-hold review, backup coordination and recovery from an accidental request.
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(candidateWorkspaceService.requestDeletion(candidateId(user)));
    }

    private UUID candidateId(AuthenticatedUser user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        return user.userId();
    }
}

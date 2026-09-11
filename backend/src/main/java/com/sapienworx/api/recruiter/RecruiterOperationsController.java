package com.sapienworx.api.recruiter;

import com.sapienworx.api.candidate.CandidateSourcingResult;
import com.sapienworx.api.reporting.PortalReportService;
import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.web.ApiPageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/recruiter")
@RequiredArgsConstructor
public class RecruiterOperationsController {
    private final RecruiterOperationsService operations;
    private final RecruiterPipelineV2Service pipelineV2;
    private final PortalReportService portalReportService;

    @GetMapping("/dashboard")
    public RecruiterDashboardResponse dashboard(@AuthenticationPrincipal AuthenticatedUser user) {
        return operations.dashboard(recruiterId(user));
    }

    @GetMapping("/reports")
    public Map<String, Object> reports(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam(defaultValue = "90") int rangeDays) {
        return portalReportService.recruiterReport(recruiterId(user), rangeDays);
    }

    @GetMapping("/reports/export.csv")
    public ResponseEntity<String> exportReport(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam(defaultValue = "90") int rangeDays) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=sapienworx-recruiter-report.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(portalReportService.recruiterCsv(recruiterId(user), rangeDays));
    }

    @GetMapping("/pipeline")
    public ApiPageResponse<PipelineCandidateResponse> pipeline(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) com.sapienworx.api.application.PipelineStage stage,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) Integer minimumExperienceYears,
            @RequestParam(required = false) Integer maximumExperienceYears,
            @RequestParam(required = false) String skill,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) String education,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Integer minimumSalaryLakhs,
            @RequestParam(required = false) Integer maximumSalaryLakhs,
            @RequestParam(required = false) Integer maximumNoticePeriodDays,
            @RequestParam(required = false) Integer activeWithinDays,
            @RequestParam(required = false) com.sapienworx.api.candidate.CandidateCareerStage careerStage,
            @RequestParam(required = false) String gender,
            @RequestParam(required = false) String jobRole,
            @RequestParam(defaultValue = "updated") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        int size = switch (pageSize) { case 10, 20, 40, 80 -> pageSize; default -> 10; };
        return ApiPageResponse.from(pipelineV2.search(
                recruiterId(user), stage, query, minimumExperienceYears, maximumExperienceYears,
                skill, company, education, location, minimumSalaryLakhs, maximumSalaryLakhs,
                maximumNoticePeriodDays, activeWithinDays, careerStage, gender, jobRole,
                sortBy, sortDirection, PageRequest.of(Math.max(0, page), size)));
    }

    @PatchMapping("/pipeline/bulk-stage")
    public List<PipelineCandidateResponse> bulkStage(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody BulkPipelineStageRequest request) {
        return pipelineV2.bulkMove(recruiterId(user), request);
    }

    @GetMapping("/jobs/{publicJobId}/applications/{applicationId}")
    public RecruiterJobApplicantDetailResponse jobApplicant(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String publicJobId,
            @PathVariable UUID applicationId) {
        return operations.jobApplicant(recruiterId(user), publicJobId, applicationId);
    }

    @PatchMapping("/jobs/{publicJobId}/applications/{applicationId}/assignment")
    public RecruiterJobApplicantDetailResponse assignApplicant(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String publicJobId,
            @PathVariable UUID applicationId,
            @Valid @RequestBody ApplicantAssignmentRequest request) {
        return operations.assignApplicant(recruiterId(user), publicJobId, applicationId, request.recruiterId());
    }

    @PatchMapping("/jobs/{publicJobId}/applications/{applicationId}/decision-policy")
    public RecruiterJobApplicantDetailResponse updateDecisionPolicy(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String publicJobId,
            @PathVariable UUID applicationId,
            @Valid @RequestBody ApplicantDecisionPolicyRequest request) {
        return operations.updateDecisionPolicy(recruiterId(user), publicJobId, applicationId, request.requiredApprovals());
    }

    @PatchMapping("/pipeline/{applicationId}/stage")
    public PipelineCandidateResponse stage(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID applicationId,
            @Valid @RequestBody PipelineStageRequest request) {
        return operations.moveStage(recruiterId(user), applicationId, request.stage());
    }

    @PostMapping("/pipeline/{applicationId}/notes")
    public PipelineCandidateResponse note(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID applicationId,
            @Valid @RequestBody RecruiterNoteRequest request) {
        return operations.addNote(recruiterId(user), applicationId, request.note());
    }

    @GetMapping("/candidates/{candidateId}/contact")
    public CandidateContactResponse contact(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID candidateId,
            @RequestParam ContactChannel channel,
            @RequestParam String jobId) {
        return operations.revealContact(recruiterId(user), candidateId, channel, jobId);
    }

    @GetMapping("/sourcing/candidates/{candidateId}")
    public com.sapienworx.api.candidate.CandidateSourcingProfileResponse sourcedProfile(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID candidateId) {
        return operations.sourcedProfile(recruiterId(user), candidateId);
    }

    @PostMapping("/sourcing/search")
    public ApiPageResponse<CandidateSourcingResult> source(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody RecruiterSourcingRequest request) {
        return ApiPageResponse.from(operations.source(recruiterId(user), request));
    }

    @PostMapping("/sourcing/candidates/{candidateId}/profile-view")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void profileView(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID candidateId) {
        operations.recordSourcedProfileView(recruiterId(user), candidateId);
    }

    @PostMapping("/sourcing/candidates/{candidateId}/profile-download")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void profileDownload(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID candidateId) {
        operations.recordSourcedProfileDownload(recruiterId(user), candidateId);
    }

    @GetMapping("/interviews/upcoming")
    public List<RecruiterDashboardResponse.UpcomingInterview> upcomingInterviews(@AuthenticationPrincipal AuthenticatedUser user) {
        return operations.dashboard(recruiterId(user)).upcomingInterviews();
    }

    @PostMapping("/interviews")
    public RecruiterDashboardResponse.UpcomingInterview schedule(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody InterviewRequest request) {
        return operations.schedule(recruiterId(user), request);
    }

    private UUID recruiterId(AuthenticatedUser user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        return user.userId();
    }
}

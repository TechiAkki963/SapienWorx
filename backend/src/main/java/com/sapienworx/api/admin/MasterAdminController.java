package com.sapienworx.api.admin;

import com.sapienworx.api.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/master")
@RequiredArgsConstructor
public class MasterAdminController {
    private final MasterAdminService service;

    @GetMapping("/dashboard") public Map<String, Object> dashboard() { return service.dashboard(); }
    @GetMapping("/activity") public List<Map<String, Object>> activity(@RequestParam(defaultValue = "") String query) { return service.activity(query); }
    @GetMapping("/users") public List<Map<String, Object>> users(@RequestParam(defaultValue = "") String query) { return service.users(query); }
    @GetMapping("/organisations") public List<Map<String, Object>> organisations(@RequestParam(defaultValue = "") String query) { return service.organisations(query); }
    @GetMapping("/jobs") public List<Map<String, Object>> jobs(@RequestParam(defaultValue = "") String query) { return service.jobs(query); }
    @GetMapping("/queues") public List<Map<String, Object>> queues() { return service.queues(); }
    @GetMapping("/support-tickets") public List<Map<String, Object>> supportTickets() { return service.supportTickets(); }
    @GetMapping("/privacy-cases") public List<Map<String, Object>> privacyCases() { return service.privacyCases(); }
    @GetMapping("/data-quality") public Map<String, Object> dataQuality() { return service.dataQuality(); }
    @GetMapping("/security") public Map<String, Object> security() { return service.securitySummary(); }
    @GetMapping("/controls") public Map<String, Object> controls() { return service.controls(); }
    @GetMapping("/breaches") public List<Map<String, Object>> breaches() { return service.breaches(); }

    @PutMapping("/controls") public Map<String, Object> updateControls(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody MasterAdminRequests.PlatformControlsUpdateRequest request) { return service.update(actor(user), request); }
    @PutMapping("/subjects/{type}/{subjectId}") public Map<String, Object> updateSubject(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable PlatformSubjectType type, @PathVariable UUID subjectId, @RequestBody MasterAdminRequests.SubjectControlRequest request) { return service.updateSubject(actor(user), type, subjectId, request); }
    @PatchMapping("/jobs/{jobId}") public Map<String, Object> moderateJob(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID jobId, @RequestBody MasterAdminRequests.JobModerationRequest request) { return service.moderateJob(actor(user), jobId, request); }
    @PostMapping("/queues/cv-dlq/retry-one") public Map<String, Object> retryCvFailure(@AuthenticationPrincipal AuthenticatedUser user) { return service.retryCvFailure(actor(user)); }
    @PostMapping("/support-tickets") public Map<String, Object> createSupportTicket(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody MasterAdminRequests.SupportTicketCreateRequest request) { return service.createSupportTicket(actor(user), request); }
    @PatchMapping("/support-tickets/{ticketId}") public Map<String, Object> updateSupportTicket(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID ticketId, @RequestBody MasterAdminRequests.SupportTicketUpdateRequest request) { return service.updateSupportTicket(actor(user), ticketId, request); }
    @PatchMapping("/privacy-cases/{candidateId}/{type}") public Map<String, Object> updatePrivacyCase(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID candidateId, @PathVariable PrivacyCaseType type, @RequestBody MasterAdminRequests.PrivacyCaseUpdateRequest request) { return service.updatePrivacyCase(actor(user), candidateId, type, request); }
    @PostMapping("/breaches") public Map<String, Object> recordBreach(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody MasterAdminRequests.BreachCreateRequest request) { return service.recordBreach(actor(user), request); }
    @PatchMapping("/breaches/{incidentId}") public Map<String, Object> updateBreach(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID incidentId, @RequestBody MasterAdminRequests.BreachUpdateRequest request) { return service.updateBreach(actor(user), incidentId, request); }
    @PostMapping("/user-activity/{type}/{subjectId}/investigate")
    public Map<String, Object> investigateUserActivity(@AuthenticationPrincipal AuthenticatedUser user,
                                                       @PathVariable PlatformSubjectType type,
                                                       @PathVariable UUID subjectId,
                                                       @RequestBody MasterAdminRequests.UserActivityInvestigationRequest request) {
        return service.investigateUserActivity(actor(user), type, subjectId, request);
    }

    @GetMapping("/reports/platform.csv")
    public ResponseEntity<String> platformReport() {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=sapienworx-platform-report.csv")
                .contentType(MediaType.parseMediaType("text/csv")) .body(service.reportCsv());
    }

    private UUID actor(AuthenticatedUser user) { return user.userId(); }
}

package com.sapienworx.api.workflow;

import com.sapienworx.api.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/recruiter/workflow")
@RequiredArgsConstructor
public class RecruiterWorkflowController {
    private final RecruiterWorkflowService workflow;
    @GetMapping("/saved-searches") public List<WorkflowResponses.SavedSearch> savedSearches(@AuthenticationPrincipal AuthenticatedUser user) { return workflow.savedSearches(recruiterId(user)); }
    @PostMapping("/saved-searches") public WorkflowResponses.SavedSearch saveSearch(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody WorkflowRequests.SavedSearchCreateRequest request) { return workflow.saveSearch(recruiterId(user), request); }
    @DeleteMapping("/saved-searches/{savedSearchId}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deleteSearch(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID savedSearchId) { workflow.deleteSearch(recruiterId(user), savedSearchId); }
    @GetMapping("/talent-pools") public List<WorkflowResponses.TalentPool> talentPools(@AuthenticationPrincipal AuthenticatedUser user) { return workflow.talentPools(recruiterId(user)); }
    @PostMapping("/talent-pools") public WorkflowResponses.TalentPool createPool(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody WorkflowRequests.TalentPoolCreateRequest request) { return workflow.createTalentPool(recruiterId(user), request); }
    @GetMapping("/talent-pools/{poolId}/members") public List<WorkflowResponses.TalentPoolMember> members(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID poolId) { return workflow.talentPoolMembers(recruiterId(user), poolId); }
    @PutMapping("/talent-pools/{poolId}/members") public WorkflowResponses.TalentPoolMember upsertMember(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID poolId, @Valid @RequestBody WorkflowRequests.TalentPoolCandidateRequest request) { return workflow.upsertTalentPoolMember(recruiterId(user), poolId, request); }
    @DeleteMapping("/talent-pools/{poolId}/members/{candidateId}") @ResponseStatus(HttpStatus.NO_CONTENT) public void removeMember(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID poolId, @PathVariable UUID candidateId) { workflow.removeTalentPoolMember(recruiterId(user), poolId, candidateId); }
    @GetMapping("/campaigns") public List<WorkflowResponses.Campaign> campaigns(@AuthenticationPrincipal AuthenticatedUser user) { return workflow.campaigns(recruiterId(user)); }
    @PostMapping("/campaigns") public WorkflowResponses.Campaign createCampaign(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody WorkflowRequests.CampaignCreateRequest request) { return workflow.createCampaign(recruiterId(user), request); }
    @PostMapping("/campaigns/{campaignId}/launch") public WorkflowResponses.Campaign launchCampaign(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID campaignId) { return workflow.launchCampaign(recruiterId(user), campaignId); }
    @GetMapping("/interviews") public List<WorkflowResponses.Interview> interviews(@AuthenticationPrincipal AuthenticatedUser user) { return workflow.interviews(recruiterId(user)); }
    @PostMapping("/interview-scorecards") public WorkflowResponses.Scorecard scorecard(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody WorkflowRequests.InterviewScorecardRequest request) { return workflow.submitScorecard(recruiterId(user), request); }
    @GetMapping("/analytics") public WorkflowResponses.RecruiterWorkflowAnalytics analytics(@AuthenticationPrincipal AuthenticatedUser user) { return workflow.analytics(recruiterId(user)); }
    @GetMapping("/organisation-controls") public WorkflowResponses.OrganisationControls organisationControls(@AuthenticationPrincipal AuthenticatedUser user) { return workflow.organisationControls(recruiterId(user)); }
    @PutMapping("/organisation-controls") public WorkflowResponses.OrganisationControls updateOrganisationControls(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody WorkflowRequests.OrganisationControlsRequest request) { return workflow.updateOrganisationControls(recruiterId(user), request); }
    @PutMapping("/organisation-controls/members") public WorkflowResponses.OrganisationControls updateMemberRole(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody WorkflowRequests.OrganisationMemberRoleRequest request) { return workflow.updateMemberRole(recruiterId(user), request); }
    private UUID recruiterId(AuthenticatedUser user) { if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required."); return user.userId(); }
}

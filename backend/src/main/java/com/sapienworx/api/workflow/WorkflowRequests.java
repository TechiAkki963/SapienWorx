package com.sapienworx.api.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class WorkflowRequests {
    private WorkflowRequests() { }

    public record SavedSearchCreateRequest(@NotBlank @Size(max = 160) String name, JsonNode criteria, @NotNull SavedSearchAlertFrequency alertFrequency) { }
    public record TalentPoolCreateRequest(@NotBlank @Size(max = 160) String name, @Size(max = 1000) String description) { }
    public record TalentPoolCandidateRequest(@NotNull UUID candidateId, @Size(max = 12) List<@Size(max = 48) String> tags,
                                             UUID ownerRecruiterId, Instant reminderAt, @Size(max = 2000) String note) { }
    public record CampaignCreateRequest(@NotBlank @Size(max = 160) String name, UUID jobInternalId, @NotBlank @Size(max = 250) String subject,
                                        @NotBlank @Size(max = 20000) String bodyHtml, @Size(min = 1, max = 200) List<UUID> candidateIds) { }
    public record InterviewScorecardRequest(@NotNull UUID interviewId, @NotBlank @Pattern(regexp = "STRONG_YES|YES|MAYBE|NO|STRONG_NO") String recommendation,
                                            @Min(1) @Max(5) int score, @NotBlank @Size(max = 4000) String feedback) { }
    public record OrganisationControlsRequest(@Min(30) @Max(3650) int candidateRetentionDays, @Min(365) @Max(7300) int auditRetentionDays,
                                              boolean savedSearchAlertsEnabled, boolean campaignsEnabled) { }
    public record OrganisationMemberRoleRequest(@NotNull UUID recruiterId, @NotNull OrganisationWorkspaceRole workspaceRole) { }
    public record CandidatePrivacyUpdateRequest(Boolean profileSearchable, Boolean automationConsent, Boolean outreachOptOut) { }
}

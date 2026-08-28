package com.sapienworx.api.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.interview.InterviewStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class WorkflowResponses {
    private WorkflowResponses() { }
    public record SavedSearch(UUID id, String name, JsonNode criteria, SavedSearchAlertFrequency alertFrequency, Instant updatedAt) { }
    public record TalentPool(UUID id, String name, String description, int candidateCount, Instant updatedAt) { }
    public record TalentPoolMember(UUID candidateId, String fullName, String headline, String location, List<String> tags, String ownerName,
                                   Instant reminderAt, String note, Instant updatedAt) { }
    public record Campaign(UUID id, String name, String subject, RecruitmentCampaignStatus status, int recipientCount, int sentCount,
                           int repliedCount, int optedOutCount, Instant updatedAt) { }
    public record Interview(UUID id, UUID applicationId, String candidateName, String jobTitle, String platformName, String meetingLink,
                            Instant scheduledAt, int durationMinutes, InterviewStatus status, List<Scorecard> scorecards) { }
    public record Scorecard(UUID id, String recruiterName, String recommendation, int score, String feedback, Instant submittedAt) { }
    public record ApplicationTimeline(UUID applicationId, PipelineStage stage, String nextStep, List<TimelineEvent> events, List<Interview> interviews) { }
    public record TimelineEvent(String type, String summary, Instant occurredAt) { }
    public record CandidatePrivacy(boolean profileSearchable, boolean automationConsent, boolean outreachOptOut, Instant dataExportRequestedAt,
                                   Instant deletionRequestedAt, Instant updatedAt) { }
    public record Referral(String code, String shareUrl, int applicationsAttributed) { }
    public record RecruiterWorkflowAnalytics(int savedSearches, int talentPools, int candidatesInPools, int activeCampaigns,
                                             int campaignsSent, int interviewsThisWeek, int scorecardsSubmitted) { }
    public record OrganisationControls(OrganisationWorkspaceRole currentUserRole, int candidateRetentionDays, int auditRetentionDays,
                                       boolean savedSearchAlertsEnabled, boolean campaignsEnabled, Instant updatedAt, List<OrganisationMember> members) { }
    public record OrganisationMember(UUID recruiterId, String fullName, String officialEmail, OrganisationWorkspaceRole workspaceRole) { }
}

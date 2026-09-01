package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.PipelineStage;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.Map;

public record RecruiterJobApplicantDetailResponse(
        UUID applicationId,
        UUID candidateId,
        String jobId,
        String jobTitle,
        String fullName,
        String headline,
        String currentCompany,
        String previousRole,
        String previousCompany,
        String departmentRole,
        String industry,
        String highestEducation,
        String location,
        List<String> preferredLocations,
        Integer overallExperienceYears,
        Integer expectedSalaryLakhs,
        Integer noticePeriodDays,
        List<String> skills,
        List<String> workLinks,
        String profileSummary,
        boolean emailVerified,
        boolean mobileVerified,
        boolean cvAvailable,
        String maskedEmail,
        String maskedMobile,
        PipelineStage pipelineStage,
        String applicationSource,
        String referralCode,
        Instant appliedAt,
        Instant applicationUpdatedAt,
        Instant lastActiveAt,
        Instant profileLastUpdatedAt,
        UUID postingRecruiterId,
        String postingRecruiterName,
        UUID assignedRecruiterId,
        String assignedRecruiterName,
        boolean currentUserCanManage,
        List<OrganisationMember> organisationMembers,
        DecisionReadiness decisionReadiness,
        List<Note> recentNotes,
        List<TimelineEvent> timeline,
        List<InterviewSummary> interviews
) {
    public record OrganisationMember(UUID recruiterId, String fullName, String designation) { }
    public record DecisionReadiness(int requiredApprovals, int expectedReviewers, int submittedScorecards,
                                    int positiveApprovals, Double averageScore, List<String> missingReviewerNames,
                                    boolean conflictingRecommendations, boolean offerReady, List<String> blockers) { }
    public record Note(String text, String author, Instant updatedAt) { }
    public record TimelineEvent(String type, String summary, String actorType, Instant occurredAt) { }
    public record Scorecard(UUID id, UUID recruiterId, String recruiterName, String recommendation, int score,
                            Map<String, Integer> criteriaScores, String feedback, Instant submittedAt) { }
    public record InterviewSummary(UUID interviewId, String platformName, String meetingLink, Instant scheduledAt,
                                   int durationMinutes, String timeZone, String agenda, String status,
                                   UUID interviewOwnerId, String interviewOwnerName, List<UUID> panelRecruiterIds,
                                   List<String> panelRecruiterNames, boolean currentUserCanScore,
                                   List<Scorecard> scorecards) { }
}

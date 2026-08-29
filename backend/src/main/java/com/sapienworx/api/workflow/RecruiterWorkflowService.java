package com.sapienworx.api.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateSkill;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.communication.RecruiterEmailCommand;
import com.sapienworx.api.communication.RecruiterEmailDispatchService;
import com.sapienworx.api.interview.InterviewRepository;
import com.sapienworx.api.interview.InterviewStatus;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import com.sapienworx.api.audit.AuditAction;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecruiterWorkflowService {
    private final RecruiterRepository recruiterRepository;
    private final CandidateRepository candidateRepository;
    private final JobRepository jobRepository;
    private final RecruiterSavedSearchRepository savedSearchRepository;
    private final TalentPoolRepository talentPoolRepository;
    private final TalentPoolCandidateRepository talentPoolCandidateRepository;
    private final RecruitmentCampaignRepository campaignRepository;
    private final RecruitmentCampaignRecipientRepository campaignRecipientRepository;
    private final CandidateContactPreferenceRepository contactPreferenceRepository;
    private final InterviewRepository interviewRepository;
    private final InterviewScorecardRepository scorecardRepository;
    private final OrganisationMemberRoleRepository memberRoleRepository;
    private final OrganisationControlRepository organisationControlRepository;
    private final RecruiterEmailDispatchService emailDispatchService;
    private final ObjectMapper objectMapper;
    private final PlatformAccessPolicy platformAccessPolicy;
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public List<WorkflowResponses.SavedSearch> savedSearches(UUID recruiterId) {
        recruiter(recruiterId);
        return savedSearchRepository.findByRecruiter_IdOrderByUpdatedAtDesc(recruiterId).stream().map(this::savedSearchResponse).toList();
    }

    @Transactional
    @AuditAction(action = "RECRUITER_SEARCH_SAVED", resourceType = "SAVED_SEARCH")
    public WorkflowResponses.SavedSearch saveSearch(UUID recruiterId, WorkflowRequests.SavedSearchCreateRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        JsonNode criteria = request.criteria() == null ? objectMapper.createObjectNode() : request.criteria();
        RecruiterSavedSearch saved = savedSearchRepository.save(RecruiterSavedSearch.builder().recruiter(recruiter).searchName(request.name().trim())
                .criteria(criteria).alertFrequency(request.alertFrequency()).build());
        return savedSearchResponse(saved);
    }

    @Transactional
    public void deleteSearch(UUID recruiterId, UUID savedSearchId) {
        savedSearchRepository.delete(savedSearchRepository.findByIdAndRecruiter_Id(savedSearchId, recruiterId)
                .orElseThrow(() -> notFound("Saved search was not found.")));
    }

    @Transactional(readOnly = true)
    public List<WorkflowResponses.TalentPool> talentPools(UUID recruiterId) {
        Recruiter recruiter = recruiter(recruiterId);
        return talentPoolRepository.findByOrganisation_IdOrderByUpdatedAtDesc(recruiter.getOrganisation().getId()).stream()
                .map(pool -> talentPoolResponse(pool, talentPoolCandidateRepository.findByTalentPool_IdOrderByUpdatedAtDesc(pool.getId()).size())).toList();
    }

    @Transactional
    @AuditAction(action = "TALENT_POOL_CREATED", resourceType = "TALENT_POOL")
    public WorkflowResponses.TalentPool createTalentPool(UUID recruiterId, WorkflowRequests.TalentPoolCreateRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        Job job = jobFor(recruiter, request.jobId());
        TalentPool pool = talentPoolRepository.save(TalentPool.builder().organisation(recruiter.getOrganisation()).createdByRecruiter(recruiter)
                .job(job).poolName(request.name().trim()).description(trimToNull(request.description())).build());
        return talentPoolResponse(pool, 0);
    }

    @Transactional(readOnly = true)
    public List<WorkflowResponses.TalentPoolMember> talentPoolMembers(UUID recruiterId, UUID poolId) {
        TalentPool pool = poolFor(recruiterId, poolId);
        return talentPoolCandidateRepository.findByTalentPool_IdOrderByUpdatedAtDesc(pool.getId()).stream().map(this::memberResponse).toList();
    }

    @Transactional
    @AuditAction(action = "TALENT_POOL_MEMBER_UPDATED", resourceType = "TALENT_POOL", resourceIdArgumentIndex = 1)
    public WorkflowResponses.TalentPoolMember upsertTalentPoolMember(UUID recruiterId, UUID poolId, WorkflowRequests.TalentPoolCandidateRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        TalentPool pool = poolFor(recruiter, poolId);
        Candidate candidate = candidateRepository.findById(request.candidateId()).orElseThrow(() -> notFound("Candidate was not found."));
        if (!candidate.isProfileSearchable()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Only searchable candidate profiles can be added to a talent pool.");
        Recruiter owner = request.ownerRecruiterId() == null ? null : recruiterRepository.findById(request.ownerRecruiterId())
                .filter(value -> value.getOrganisation().getId().equals(recruiter.getOrganisation().getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "The selected owner is not in your organisation."));
        TalentPoolCandidate member = talentPoolCandidateRepository.findByTalentPool_IdAndCandidate_Id(poolId, candidate.getId())
                .orElseGet(() -> TalentPoolCandidate.builder().talentPool(pool).candidate(candidate).addedByRecruiter(recruiter).build());
        member.setTags(normalizedTags(request.tags())); member.setOwnerRecruiter(owner); member.setReminderAt(request.reminderAt());
        member.setCollaborationNote(trimToNull(request.note())); member.setNextAction(trimToNull(request.nextAction()));
        return memberResponse(talentPoolCandidateRepository.save(member));
    }

    @Transactional
    public void removeTalentPoolMember(UUID recruiterId, UUID poolId, UUID candidateId) {
        poolFor(recruiterId, poolId);
        talentPoolCandidateRepository.delete(talentPoolCandidateRepository.findByTalentPool_IdAndCandidate_Id(poolId, candidateId)
                .orElseThrow(() -> notFound("Candidate is not in this talent pool.")));
    }

    @Transactional(readOnly = true)
    public List<WorkflowResponses.Campaign> campaigns(UUID recruiterId) {
        recruiter(recruiterId);
        return campaignRepository.findByRecruiter_IdOrderByUpdatedAtDesc(recruiterId).stream().map(this::campaignResponse).toList();
    }

    @Transactional
    @AuditAction(action = "RECRUITMENT_CAMPAIGN_CREATED", resourceType = "CAMPAIGN")
    public WorkflowResponses.Campaign createCampaign(UUID recruiterId, WorkflowRequests.CampaignCreateRequest request) {
        platformAccessPolicy.requireCampaignsEnabled();
        Recruiter recruiter = recruiter(recruiterId);
        Job job = request.jobId() == null || request.jobId().isBlank()
                ? request.jobInternalId() == null ? null : jobRepository.findById(request.jobInternalId())
                    .filter(value -> value.getOrganisation().getId().equals(recruiter.getOrganisation().getId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a job from your organisation."))
                : jobFor(recruiter, request.jobId());
        RecruitmentCampaign campaign = campaignRepository.save(RecruitmentCampaign.builder().recruiter(recruiter).job(job).campaignName(request.name().trim())
                .subject(request.subject().trim()).bodyHtml(request.bodyHtml().trim()).build());
        request.candidateIds().stream().distinct().forEach(candidateId -> {
            Candidate candidate = candidateRepository.findById(candidateId).orElseThrow(() -> notFound("Candidate was not found."));
            boolean optedOut = contactPreferenceRepository.findById(candidateId).map(CandidateContactPreference::isOutreachOptOut).orElse(false);
            CampaignRecipientStatus status = optedOut ? CampaignRecipientStatus.OPTED_OUT
                    : !candidate.isEmailVerified() || !candidate.isAutomationConsent() ? CampaignRecipientStatus.EXCLUDED : CampaignRecipientStatus.QUEUED;
            campaignRecipientRepository.save(RecruitmentCampaignRecipient.builder().campaign(campaign).candidate(candidate).deliveryStatus(status)
                    .optedOutAt(status == CampaignRecipientStatus.OPTED_OUT ? Instant.now() : null).build());
        });
        return campaignResponse(campaign);
    }

    @Transactional
    @AuditAction(action = "RECRUITMENT_CAMPAIGN_LAUNCHED", resourceType = "CAMPAIGN", resourceIdArgumentIndex = 1)
    public WorkflowResponses.Campaign launchCampaign(UUID recruiterId, UUID campaignId) {
        platformAccessPolicy.requireCampaignsEnabled();
        RecruitmentCampaign campaign = campaignRepository.findByIdAndRecruiter_Id(campaignId, recruiterId).orElseThrow(() -> notFound("Campaign was not found."));
        campaign.setCampaignStatus(RecruitmentCampaignStatus.QUEUED);
        for (RecruitmentCampaignRecipient recipient : campaignRecipientRepository.findByCampaign_Id(campaignId)) {
            if (recipient.getDeliveryStatus() != CampaignRecipientStatus.QUEUED) continue;
            try {
                emailDispatchService.queueForCandidate(recipient.getCandidate().getId(), new RecruiterEmailCommand(recipient.getCandidate().getId(),
                        campaign.getJob() == null ? null : campaign.getJob().getPublicJobId(), campaign.getSubject(), campaign.getBodyHtml()));
                recipient.setDeliveryStatus(CampaignRecipientStatus.SENT); recipient.setSentAt(Instant.now());
            } catch (IllegalStateException ignored) {
                recipient.setDeliveryStatus(CampaignRecipientStatus.EXCLUDED);
            }
        }
        campaign.setCampaignStatus(RecruitmentCampaignStatus.SENT);
        return campaignResponse(campaign);
    }

    @Transactional(readOnly = true)
    public List<WorkflowResponses.Interview> interviews(UUID recruiterId) {
        recruiter(recruiterId);
        return interviewRepository.findByRecruiter_IdAndScheduledAtAfterOrderByScheduledAtAsc(recruiterId, Instant.now().minus(30, ChronoUnit.DAYS), org.springframework.data.domain.PageRequest.of(0, 100))
                .stream().map(this::interviewResponse).toList();
    }

    @Transactional
    @AuditAction(action = "INTERVIEW_SCORECARD_SUBMITTED", resourceType = "INTERVIEW")
    public WorkflowResponses.Scorecard submitScorecard(UUID recruiterId, WorkflowRequests.InterviewScorecardRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        var interview = interviewRepository.findById(request.interviewId()).filter(value -> value.getRecruiter().getOrganisation().getId().equals(recruiter.getOrganisation().getId()))
                .orElseThrow(() -> notFound("Interview was not found."));
        InterviewScorecard scorecard = scorecardRepository.findByInterview_IdAndRecruiter_Id(interview.getId(), recruiterId)
                .orElseGet(() -> InterviewScorecard.builder().interview(interview).recruiter(recruiter).build());
        scorecard.setRecommendation(request.recommendation()); scorecard.setScore(request.score()); scorecard.setFeedback(request.feedback().trim());
        return scorecardResponse(scorecardRepository.save(scorecard));
    }

    @Transactional
    @AuditAction(action = "INTERVIEW_UPDATED", resourceType = "INTERVIEW", resourceIdArgumentIndex = 1)
    public WorkflowResponses.Interview updateInterview(UUID recruiterId, UUID interviewId, WorkflowRequests.InterviewUpdateRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        var interview = interviewRepository.findById(interviewId)
                .filter(value -> value.getRecruiter().getOrganisation().getId().equals(recruiter.getOrganisation().getId()))
                .orElseThrow(() -> notFound("Interview was not found."));
        if (request.scheduledAt() != null) {
            if (request.scheduledAt().isBefore(Instant.now())) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a future interview time.");
            requireNoInterviewConflict(recruiterId, interviewId, request.scheduledAt(), request.durationMinutes() == null ? interview.getDurationMinutes() : request.durationMinutes());
            interview.setScheduledAt(request.scheduledAt());
            interview.setStatus(InterviewStatus.RESCHEDULED);
        }
        if (request.platformName() != null && !request.platformName().isBlank()) interview.setPlatformName(request.platformName().trim());
        if (request.meetingLink() != null && !request.meetingLink().isBlank()) interview.setMeetingLink(request.meetingLink().trim());
        if (request.durationMinutes() != null) interview.setDurationMinutes(request.durationMinutes());
        if (request.timeZone() != null && !request.timeZone().isBlank()) interview.setTimeZone(request.timeZone().trim());
        if (request.agenda() != null) interview.setAgenda(trimToNull(request.agenda()));
        if (request.panelRecruiterIds() != null) interview.setPanelRecruiterIds(validPanelRecruiterIds(recruiter, request.panelRecruiterIds()));
        if (request.status() != null) interview.setStatus(InterviewStatus.valueOf(request.status()));
        return interviewResponse(interviewRepository.save(interview));
    }

    @Transactional(readOnly = true)
    public WorkflowResponses.RecruiterWorkflowAnalytics analytics(UUID recruiterId) {
        recruiter(recruiterId);
        List<TalentPool> pools = talentPoolRepository.findByOrganisation_IdOrderByUpdatedAtDesc(recruiter(recruiterId).getOrganisation().getId());
        int candidatesInPools = pools.stream().mapToInt(pool -> talentPoolCandidateRepository.findByTalentPool_IdOrderByUpdatedAtDesc(pool.getId()).size()).sum();
        List<RecruitmentCampaign> campaigns = campaignRepository.findByRecruiter_IdOrderByUpdatedAtDesc(recruiterId);
        int sent = campaigns.stream().mapToInt(campaign -> (int) campaignRecipientRepository.countByCampaign_IdAndDeliveryStatus(campaign.getId(), CampaignRecipientStatus.SENT)).sum();
        int active = (int) campaigns.stream().filter(campaign -> campaign.getCampaignStatus() == RecruitmentCampaignStatus.QUEUED || campaign.getCampaignStatus() == RecruitmentCampaignStatus.SENT).count();
        var interviews = interviewRepository.findByRecruiter_IdAndScheduledAtAfterOrderByScheduledAtAsc(recruiterId, Instant.now().minus(7, ChronoUnit.DAYS), org.springframework.data.domain.PageRequest.of(0, 100));
        int scorecards = interviews.stream().mapToInt(interview -> scorecardRepository.findByInterview_IdOrderBySubmittedAtDesc(interview.getId()).size()).sum();
        int replies = campaigns.stream().mapToInt(campaign -> (int) campaignRecipientRepository.countByCampaign_IdAndDeliveryStatus(campaign.getId(), CampaignRecipientStatus.REPLIED)).sum();
        int pendingScorecards = (int) interviews.stream().filter(interview -> interview.getStatus() != InterviewStatus.CANCELLED
                && scorecardRepository.findByInterview_IdOrderBySubmittedAtDesc(interview.getId()).isEmpty()).count();
        int upcoming = (int) interviews.stream().filter(interview -> interview.getScheduledAt().isAfter(Instant.now())
                && interview.getStatus() != InterviewStatus.CANCELLED && interview.getStatus() != InterviewStatus.COMPLETED).count();
        int dueReminders = (int) Math.min(Integer.MAX_VALUE,
                talentPoolCandidateRepository.countByTalentPool_Organisation_IdAndReminderAtBefore(recruiter(recruiterId).getOrganisation().getId(), Instant.now()));
        return new WorkflowResponses.RecruiterWorkflowAnalytics(savedSearchRepository.findByRecruiter_IdOrderByUpdatedAtDesc(recruiterId).size(), pools.size(), candidatesInPools,
                active, sent, interviews.getNumberOfElements(), scorecards, dueReminders, replies, pendingScorecards, upcoming);
    }

    @Transactional
    public WorkflowResponses.OrganisationControls organisationControls(UUID recruiterId) {
        Recruiter recruiter = recruiter(recruiterId);
        OrganisationMemberRole role = memberRole(recruiter);
        OrganisationControl controls = organisationControlRepository.findById(recruiter.getOrganisation().getId())
                .orElseGet(() -> organisationControlRepository.save(OrganisationControl.builder().organisation(recruiter.getOrganisation()).build()));
        return organisationControlsResponse(recruiter.getOrganisation().getId(), role.getWorkspaceRole(), controls);
    }

    @Transactional
    public WorkflowResponses.RecruiterAccountSettings accountSettings(UUID recruiterId) {
        Recruiter recruiter = recruiter(recruiterId);
        OrganisationMemberRole role = memberRole(recruiter);
        OrganisationControl controls = organisationControlRepository.findById(recruiter.getOrganisation().getId())
                .orElseGet(() -> organisationControlRepository.save(OrganisationControl.builder().organisation(recruiter.getOrganisation()).build()));
        List<WorkflowResponses.RecruiterAccountSettings> settings = jdbc.query("""
                select billing.plan_name, billing.recruiter_seat_limit, billing.monthly_job_credit_limit,
                       billing.invoice_status, billing.renewal_at,
                       (select count(*) from recruiters member where member.organisation_id = billing.organisation_id) seats_used,
                       (select count(*) from jobs job where job.organisation_id = billing.organisation_id and job.created_at >= date_trunc('month', now())) jobs_this_month
                from organisation_billing_plans billing where billing.organisation_id = ?
                """, (result, row) -> new WorkflowResponses.RecruiterAccountSettings(
                recruiter.getOrganisation().getId(), recruiter.getOrganisation().getName(), role.getWorkspaceRole(),
                result.getString("plan_name"), result.getInt("recruiter_seat_limit"), result.getLong("seats_used"),
                result.getInt("monthly_job_credit_limit"), result.getLong("jobs_this_month"), result.getString("invoice_status"),
                result.getTimestamp("renewal_at") == null ? null : result.getTimestamp("renewal_at").toInstant(),
                controls.isSavedSearchAlertsEnabled(), controls.isCampaignsEnabled(), recruiter.getAccountReviewStatus().name(),
                recruiter.getReviewDueAt(), recruiter.getOrganisation().getWorkEmailDomain()), recruiter.getOrganisation().getId());
        if (!settings.isEmpty()) return settings.get(0);
        return new WorkflowResponses.RecruiterAccountSettings(recruiter.getOrganisation().getId(), recruiter.getOrganisation().getName(),
                role.getWorkspaceRole(), "UNASSIGNED", 0, recruiterRepository.findByOrganisation_Id(recruiter.getOrganisation().getId()).size(),
                0, 0, "NOT_CONFIGURED", null, controls.isSavedSearchAlertsEnabled(), controls.isCampaignsEnabled(),
                recruiter.getAccountReviewStatus().name(), recruiter.getReviewDueAt(), recruiter.getOrganisation().getWorkEmailDomain());
    }

    @Transactional
    public WorkflowResponses.OrganisationControls updateOrganisationControls(UUID recruiterId, WorkflowRequests.OrganisationControlsRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        OrganisationMemberRole role = memberRole(recruiter);
        if (role.getWorkspaceRole() != OrganisationWorkspaceRole.ORG_ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only organisation administrators can update controls.");
        OrganisationControl controls = organisationControlRepository.findById(recruiter.getOrganisation().getId())
                .orElseGet(() -> OrganisationControl.builder().organisation(recruiter.getOrganisation()).build());
        controls.setCandidateRetentionDays(request.candidateRetentionDays()); controls.setAuditRetentionDays(request.auditRetentionDays());
        controls.setSavedSearchAlertsEnabled(request.savedSearchAlertsEnabled()); controls.setCampaignsEnabled(request.campaignsEnabled());
        return organisationControlsResponse(recruiter.getOrganisation().getId(), role.getWorkspaceRole(), organisationControlRepository.save(controls));
    }

    @Transactional
    public WorkflowResponses.OrganisationControls updateMemberRole(UUID recruiterId, WorkflowRequests.OrganisationMemberRoleRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        OrganisationMemberRole actorRole = memberRole(recruiter);
        if (actorRole.getWorkspaceRole() != OrganisationWorkspaceRole.ORG_ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only organisation administrators can update member roles.");
        Recruiter member = recruiterRepository.findById(request.recruiterId()).filter(value -> value.getOrganisation().getId().equals(recruiter.getOrganisation().getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a recruiter from your organisation."));
        OrganisationMemberRole memberRole = memberRole(member); memberRole.setWorkspaceRole(request.workspaceRole()); memberRoleRepository.save(memberRole);
        return organisationControls(recruiterId);
    }

    private WorkflowResponses.SavedSearch savedSearchResponse(RecruiterSavedSearch search) {
        String alertStatus = search.getAlertFrequency() == SavedSearchAlertFrequency.OFF ? "OFF"
                : search.getLastAlertedAt() == null ? "READY" : "HEALTHY";
        return new WorkflowResponses.SavedSearch(search.getId(), search.getSearchName(), search.getCriteria(), search.getAlertFrequency(), search.getLastAlertedAt(), alertStatus, search.getUpdatedAt());
    }
    private WorkflowResponses.TalentPool talentPoolResponse(TalentPool pool, int candidateCount) {
        return new WorkflowResponses.TalentPool(pool.getId(), pool.getPoolName(), pool.getDescription(), pool.getJob() == null ? null : pool.getJob().getPublicJobId(),
                pool.getJob() == null ? null : pool.getJob().getTitle(), candidateCount, pool.getUpdatedAt());
    }
    private WorkflowResponses.TalentPoolMember memberResponse(TalentPoolCandidate member) {
        Candidate candidate = member.getCandidate();
        return new WorkflowResponses.TalentPoolMember(candidate.getId(), candidate.getFullName(), candidate.getHeadline(), candidate.getLocation(), member.getTags(),
                member.getOwnerRecruiter() == null ? null : member.getOwnerRecruiter().getFullName(), member.getReminderAt(), member.getCollaborationNote(), member.getNextAction(),
                candidate.getOverallExperienceYears(), candidate.getExpectedSalaryLakhs(), candidate.getNoticePeriodDays(),
                candidate.getSkills().stream().map(CandidateSkill::getSkill).sorted().toList(), candidate.isEmailVerified(), candidate.isMobileVerified(),
                candidate.getLastActiveAt(), candidate.getUpdatedAt(), member.getUpdatedAt());
    }
    private WorkflowResponses.Campaign campaignResponse(RecruitmentCampaign campaign) {
        UUID id = campaign.getId(); int recipients = campaignRecipientRepository.findByCampaign_Id(id).size();
        int sent = (int) campaignRecipientRepository.countByCampaign_IdAndDeliveryStatus(id, CampaignRecipientStatus.SENT);
        int replies = (int) campaignRecipientRepository.countByCampaign_IdAndDeliveryStatus(id, CampaignRecipientStatus.REPLIED);
        return new WorkflowResponses.Campaign(id, campaign.getCampaignName(), campaign.getSubject(), campaign.getCampaignStatus(), recipients, sent, replies,
                (int) campaignRecipientRepository.countByCampaign_IdAndDeliveryStatus(id, CampaignRecipientStatus.OPTED_OUT),
                (int) campaignRecipientRepository.countByCampaign_IdAndDeliveryStatus(id, CampaignRecipientStatus.EXCLUDED), sent == 0 ? 0 : Math.round(replies * 100f / sent),
                campaign.getJob() == null ? null : campaign.getJob().getPublicJobId(), campaign.getJob() == null ? null : campaign.getJob().getTitle(), campaign.getUpdatedAt());
    }
    private WorkflowResponses.Interview interviewResponse(com.sapienworx.api.interview.Interview interview) {
        List<UUID> panelIds = interview.getPanelRecruiterIds() == null ? List.of() : interview.getPanelRecruiterIds();
        List<String> panelNames = recruiterRepository.findAllById(panelIds).stream().map(Recruiter::getFullName).toList();
        return new WorkflowResponses.Interview(interview.getId(), interview.getApplication().getId(), interview.getApplication().getCandidate().getFullName(),
                interview.getApplication().getJob().getTitle(), interview.getPlatformName(), interview.getMeetingLink(), interview.getScheduledAt(), interview.getDurationMinutes(),
                interview.getTimeZone(), interview.getAgenda(), panelIds, panelNames, interview.getStatus(),
                scorecardRepository.findByInterview_IdOrderBySubmittedAtDesc(interview.getId()).stream().map(this::scorecardResponse).toList());
    }
    private WorkflowResponses.Scorecard scorecardResponse(InterviewScorecard scorecard) { return new WorkflowResponses.Scorecard(scorecard.getId(), scorecard.getRecruiter().getFullName(), scorecard.getRecommendation(), scorecard.getScore(), scorecard.getFeedback(), scorecard.getSubmittedAt()); }
    private Recruiter recruiter(UUID id) { return recruiterRepository.findById(id).orElseThrow(() -> notFound("Recruiter profile was not found.")); }
    private TalentPool poolFor(UUID recruiterId, UUID poolId) { return poolFor(recruiter(recruiterId), poolId); }
    private TalentPool poolFor(Recruiter recruiter, UUID poolId) { return talentPoolRepository.findByIdAndOrganisation_Id(poolId, recruiter.getOrganisation().getId()).orElseThrow(() -> notFound("Talent pool was not found.")); }
    private List<String> normalizedTags(List<String> tags) { return tags == null ? List.of() : tags.stream().filter(value -> value != null && !value.isBlank()).map(String::trim).distinct().toList(); }
    private String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private Job jobFor(Recruiter recruiter, String publicJobId) {
        if (publicJobId == null || publicJobId.isBlank()) return null;
        return jobRepository.findByPublicJobId(publicJobId.trim())
                .filter(value -> value.getOrganisation().getId().equals(recruiter.getOrganisation().getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a job from your organisation."));
    }
    private List<UUID> validPanelRecruiterIds(Recruiter recruiter, List<UUID> panelRecruiterIds) {
        if (panelRecruiterIds == null) return List.of();
        List<UUID> unique = panelRecruiterIds.stream().filter(java.util.Objects::nonNull).distinct().limit(12).toList();
        boolean invalid = recruiterRepository.findAllById(unique).stream().anyMatch(member -> !member.getOrganisation().getId().equals(recruiter.getOrganisation().getId()));
        if (invalid || recruiterRepository.findAllById(unique).size() != unique.size()) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Every interviewer must belong to your organisation.");
        return unique;
    }
    private void requireNoInterviewConflict(UUID recruiterId, UUID ignoredInterviewId, Instant scheduledAt, int durationMinutes) {
        Instant end = scheduledAt.plus(durationMinutes, ChronoUnit.MINUTES);
        boolean conflict = interviewRepository.findByRecruiter_IdAndScheduledAtAfterOrderByScheduledAtAsc(recruiterId, scheduledAt.minus(1, ChronoUnit.DAYS), org.springframework.data.domain.PageRequest.of(0, 200))
                .stream().filter(value -> ignoredInterviewId == null || !value.getId().equals(ignoredInterviewId))
                .filter(value -> value.getStatus() != InterviewStatus.CANCELLED)
                .anyMatch(value -> value.getScheduledAt().isBefore(end) && value.getScheduledAt().plus(value.getDurationMinutes(), ChronoUnit.MINUTES).isAfter(scheduledAt));
        if (conflict) throw new ResponseStatusException(HttpStatus.CONFLICT, "This recruiter already has an interview during the selected time.");
    }
    private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }
    private OrganisationMemberRole memberRole(Recruiter recruiter) {
        return memberRoleRepository.findByRecruiter_Id(recruiter.getId()).orElseGet(() -> {
            OrganisationWorkspaceRole initialRole = memberRoleRepository.countByOrganisation_Id(recruiter.getOrganisation().getId()) == 0
                    ? OrganisationWorkspaceRole.ORG_ADMIN : OrganisationWorkspaceRole.RECRUITER;
            return memberRoleRepository.save(OrganisationMemberRole.builder().recruiter(recruiter).organisation(recruiter.getOrganisation()).workspaceRole(initialRole).build());
        });
    }
    private WorkflowResponses.OrganisationControls organisationControlsResponse(UUID organisationId, OrganisationWorkspaceRole currentUserRole, OrganisationControl controls) {
        List<WorkflowResponses.OrganisationMember> members = memberRoleRepository.findByOrganisation_IdOrderByWorkspaceRoleAsc(organisationId).stream()
                .map(member -> new WorkflowResponses.OrganisationMember(member.getRecruiter().getId(), member.getRecruiter().getFullName(), member.getRecruiter().getOfficialEmail(), member.getWorkspaceRole())).toList();
        return new WorkflowResponses.OrganisationControls(currentUserRole, controls.getCandidateRetentionDays(), controls.getAuditRetentionDays(), controls.isSavedSearchAlertsEnabled(), controls.isCampaignsEnabled(), controls.getUpdatedAt(), members);
    }
}

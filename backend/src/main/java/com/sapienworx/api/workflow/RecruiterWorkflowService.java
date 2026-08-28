package com.sapienworx.api.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.communication.RecruiterEmailCommand;
import com.sapienworx.api.communication.RecruiterEmailDispatchService;
import com.sapienworx.api.interview.InterviewRepository;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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

    @Transactional(readOnly = true)
    public List<WorkflowResponses.SavedSearch> savedSearches(UUID recruiterId) {
        recruiter(recruiterId);
        return savedSearchRepository.findByRecruiter_IdOrderByUpdatedAtDesc(recruiterId).stream().map(this::savedSearchResponse).toList();
    }

    @Transactional
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
                .map(pool -> new WorkflowResponses.TalentPool(pool.getId(), pool.getPoolName(), pool.getDescription(),
                        talentPoolCandidateRepository.findByTalentPool_IdOrderByUpdatedAtDesc(pool.getId()).size(), pool.getUpdatedAt())).toList();
    }

    @Transactional
    public WorkflowResponses.TalentPool createTalentPool(UUID recruiterId, WorkflowRequests.TalentPoolCreateRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        TalentPool pool = talentPoolRepository.save(TalentPool.builder().organisation(recruiter.getOrganisation()).createdByRecruiter(recruiter)
                .poolName(request.name().trim()).description(trimToNull(request.description())).build());
        return new WorkflowResponses.TalentPool(pool.getId(), pool.getPoolName(), pool.getDescription(), 0, pool.getUpdatedAt());
    }

    @Transactional(readOnly = true)
    public List<WorkflowResponses.TalentPoolMember> talentPoolMembers(UUID recruiterId, UUID poolId) {
        TalentPool pool = poolFor(recruiterId, poolId);
        return talentPoolCandidateRepository.findByTalentPool_IdOrderByUpdatedAtDesc(pool.getId()).stream().map(this::memberResponse).toList();
    }

    @Transactional
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
        member.setTags(normalizedTags(request.tags())); member.setOwnerRecruiter(owner); member.setReminderAt(request.reminderAt()); member.setCollaborationNote(trimToNull(request.note()));
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
    public WorkflowResponses.Campaign createCampaign(UUID recruiterId, WorkflowRequests.CampaignCreateRequest request) {
        platformAccessPolicy.requireCampaignsEnabled();
        Recruiter recruiter = recruiter(recruiterId);
        Job job = request.jobInternalId() == null ? null : jobRepository.findById(request.jobInternalId())
                .filter(value -> value.getOrganisation().getId().equals(recruiter.getOrganisation().getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a job from your organisation."));
        RecruitmentCampaign campaign = campaignRepository.save(RecruitmentCampaign.builder().recruiter(recruiter).job(job).campaignName(request.name().trim())
                .subject(request.subject().trim()).bodyHtml(request.bodyHtml().trim()).build());
        request.candidateIds().stream().distinct().forEach(candidateId -> {
            Candidate candidate = candidateRepository.findById(candidateId).orElseThrow(() -> notFound("Candidate was not found."));
            CampaignRecipientStatus status = contactPreferenceRepository.findById(candidateId).map(CandidateContactPreference::isOutreachOptOut).orElse(false)
                    ? CampaignRecipientStatus.OPTED_OUT : CampaignRecipientStatus.QUEUED;
            campaignRecipientRepository.save(RecruitmentCampaignRecipient.builder().campaign(campaign).candidate(candidate).deliveryStatus(status)
                    .optedOutAt(status == CampaignRecipientStatus.OPTED_OUT ? Instant.now() : null).build());
        });
        return campaignResponse(campaign);
    }

    @Transactional
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
                recipient.setDeliveryStatus(CampaignRecipientStatus.OPTED_OUT); recipient.setOptedOutAt(Instant.now());
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
    public WorkflowResponses.Scorecard submitScorecard(UUID recruiterId, WorkflowRequests.InterviewScorecardRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        var interview = interviewRepository.findById(request.interviewId()).filter(value -> value.getRecruiter().getOrganisation().getId().equals(recruiter.getOrganisation().getId()))
                .orElseThrow(() -> notFound("Interview was not found."));
        InterviewScorecard scorecard = scorecardRepository.findByInterview_IdAndRecruiter_Id(interview.getId(), recruiterId)
                .orElseGet(() -> InterviewScorecard.builder().interview(interview).recruiter(recruiter).build());
        scorecard.setRecommendation(request.recommendation()); scorecard.setScore(request.score()); scorecard.setFeedback(request.feedback().trim());
        return scorecardResponse(scorecardRepository.save(scorecard));
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
        return new WorkflowResponses.RecruiterWorkflowAnalytics(savedSearchRepository.findByRecruiter_IdOrderByUpdatedAtDesc(recruiterId).size(), pools.size(), candidatesInPools,
                active, sent, interviews.getNumberOfElements(), scorecards);
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

    private WorkflowResponses.SavedSearch savedSearchResponse(RecruiterSavedSearch search) { return new WorkflowResponses.SavedSearch(search.getId(), search.getSearchName(), search.getCriteria(), search.getAlertFrequency(), search.getUpdatedAt()); }
    private WorkflowResponses.TalentPoolMember memberResponse(TalentPoolCandidate member) { Candidate candidate = member.getCandidate(); return new WorkflowResponses.TalentPoolMember(candidate.getId(), candidate.getFullName(), candidate.getHeadline(), candidate.getLocation(), member.getTags(), member.getOwnerRecruiter() == null ? null : member.getOwnerRecruiter().getFullName(), member.getReminderAt(), member.getCollaborationNote(), member.getUpdatedAt()); }
    private WorkflowResponses.Campaign campaignResponse(RecruitmentCampaign campaign) { UUID id = campaign.getId(); return new WorkflowResponses.Campaign(id, campaign.getCampaignName(), campaign.getSubject(), campaign.getCampaignStatus(), campaignRecipientRepository.findByCampaign_Id(id).size(), (int) campaignRecipientRepository.countByCampaign_IdAndDeliveryStatus(id, CampaignRecipientStatus.SENT), (int) campaignRecipientRepository.countByCampaign_IdAndDeliveryStatus(id, CampaignRecipientStatus.REPLIED), (int) campaignRecipientRepository.countByCampaign_IdAndDeliveryStatus(id, CampaignRecipientStatus.OPTED_OUT), campaign.getUpdatedAt()); }
    private WorkflowResponses.Interview interviewResponse(com.sapienworx.api.interview.Interview interview) { return new WorkflowResponses.Interview(interview.getId(), interview.getApplication().getId(), interview.getApplication().getCandidate().getFullName(), interview.getApplication().getJob().getTitle(), interview.getPlatformName(), interview.getMeetingLink(), interview.getScheduledAt(), interview.getDurationMinutes(), interview.getStatus(), scorecardRepository.findByInterview_IdOrderBySubmittedAtDesc(interview.getId()).stream().map(this::scorecardResponse).toList()); }
    private WorkflowResponses.Scorecard scorecardResponse(InterviewScorecard scorecard) { return new WorkflowResponses.Scorecard(scorecard.getId(), scorecard.getRecruiter().getFullName(), scorecard.getRecommendation(), scorecard.getScore(), scorecard.getFeedback(), scorecard.getSubmittedAt()); }
    private Recruiter recruiter(UUID id) { return recruiterRepository.findById(id).orElseThrow(() -> notFound("Recruiter profile was not found.")); }
    private TalentPool poolFor(UUID recruiterId, UUID poolId) { return poolFor(recruiter(recruiterId), poolId); }
    private TalentPool poolFor(Recruiter recruiter, UUID poolId) { return talentPoolRepository.findByIdAndOrganisation_Id(poolId, recruiter.getOrganisation().getId()).orElseThrow(() -> notFound("Talent pool was not found.")); }
    private List<String> normalizedTags(List<String> tags) { return tags == null ? List.of() : tags.stream().filter(value -> value != null && !value.isBlank()).map(String::trim).distinct().toList(); }
    private String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
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

package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.application.RecruiterNote;
import com.sapienworx.api.application.RecruiterNoteRepository;
import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.candidate.CandidateSourcingCriteria;
import com.sapienworx.api.candidate.CandidateSourcingProfileResponse;
import com.sapienworx.api.candidate.CandidateSourcingResult;
import com.sapienworx.api.candidate.CandidateSourcingService;
import com.sapienworx.api.candidate.CandidateEducation;
import com.sapienworx.api.cvparser.CandidateParseResultRepository;
import com.sapienworx.api.events.PipelineUpdateEvent;
import com.sapienworx.api.events.SseNotificationService;
import com.sapienworx.api.interview.Interview;
import com.sapienworx.api.interview.InterviewRepository;
import com.sapienworx.api.interview.InterviewStatus;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.offer.OfferService;
import com.sapienworx.api.workflow.ApplicationEventService;
import com.sapienworx.api.workflow.ApplicationEventRepository;
import com.sapienworx.api.workflow.InterviewScorecardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecruiterOperationsService {
    private final RecruiterRepository recruiterRepository;
    private final JobRepository jobRepository;
    private final JobApplicationRepository applicationRepository;
    private final RecruiterNoteRepository recruiterNoteRepository;
    private final CandidateSourcingService candidateSourcingService;
    private final CandidateRepository candidateRepository;
    private final CandidateProfileEngagementRepository candidateProfileEngagementRepository;
    private final CandidateParseResultRepository candidateParseResultRepository;
    private final InterviewRepository interviewRepository;
    private final NotificationService notificationService;
    private final SseNotificationService sseNotificationService;
    private final ApplicationEventService applicationEventService;
    private final ApplicationEventRepository applicationEventRepository;
    private final InterviewScorecardRepository interviewScorecardRepository;
    private final OfferService offerService;

    @Transactional(readOnly = true)
    public RecruiterDashboardResponse dashboard(UUID recruiterId) {
        Recruiter recruiter = recruiter(recruiterId);
        UUID organisationId = recruiter.getOrganisation().getId();
        Map<PipelineStage, Long> funnel = new EnumMap<>(PipelineStage.class);
        for (PipelineStage stage : PipelineStage.values()) funnel.put(stage, applicationRepository.countAccessibleByRecruiterAndStage(recruiterId, stage));
        List<RecruiterDashboardResponse.UpcomingInterview> interviews = interviewRepository
                .findByRecruiter_IdAndScheduledAtAfterOrderByScheduledAtAsc(recruiterId, Instant.now(), org.springframework.data.domain.PageRequest.of(0, 5))
                .stream().map(interview -> new RecruiterDashboardResponse.UpcomingInterview(
                        interview.getApplication().getCandidate().getFullName(), interview.getApplication().getJob().getTitle(),
                        interview.getPlatformName(), interview.getMeetingLink(), interview.getScheduledAt(), interview.getDurationMinutes())).toList();
        long activeApplications = funnel.values().stream().mapToLong(Long::longValue).sum();
        return new RecruiterDashboardResponse(jobRepository.countByOrganisation_IdAndStatus(organisationId, JobStatus.ACTIVE), activeApplications,
                Map.copyOf(funnel), jobRepository.countByOrganisation_IdAndStatus(organisationId, JobStatus.DRAFT), interviews);
    }

    @Transactional(readOnly = true)
    public Page<PipelineCandidateResponse> pipeline(UUID recruiterId, PipelineStage stage, String query, Pageable pageable) {
        recruiter(recruiterId);
        return applicationRepository.searchPipeline(recruiterId, stage, query == null ? "" : query.trim(), pageable).map(this::pipelineResponse);
    }

    @Transactional(readOnly = true)
    public RecruiterJobApplicantDetailResponse jobApplicant(UUID recruiterId, String publicJobId, UUID applicationId) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = applicationVisibleToRecruiter(applicationId, recruiter);
        if (!application.getJob().getPublicJobId().equalsIgnoreCase(publicJobId.trim())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate application was not found for this job.");
        }
        Candidate candidate = application.getCandidate();
        String education = candidate.getEducation().stream()
                .max(Comparator.comparing(CandidateEducation::getGraduationYear, Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(value -> value.getDegreeName() + " · " + value.getInstitutionName()
                        + (value.getGraduationYear() == null ? "" : " " + value.getGraduationYear()))
                .orElse("Education not shared");
        var notes = recruiterNoteRepository.findTop10ByApplication_IdOrderByUpdatedAtDesc(applicationId).stream()
                .map(note -> new RecruiterJobApplicantDetailResponse.Note(note.getNoteText(), note.getRecruiter().getFullName(), note.getUpdatedAt()))
                .toList();
        var organisationMembers = recruiterRepository.findByOrganisation_IdOrderByFullNameAsc(recruiter.getOrganisation().getId());
        var memberNames = organisationMembers.stream().collect(java.util.stream.Collectors.toMap(Recruiter::getId, Recruiter::getFullName));
        var timeline = applicationEventRepository.findByApplication_IdOrderByCreatedAtDesc(applicationId).stream()
                .map(event -> new RecruiterJobApplicantDetailResponse.TimelineEvent(event.getEventType(), event.getEventSummary(),
                        event.getActorType(), event.getCreatedAt())).toList();
        List<Interview> applicationInterviews = interviewRepository.findByApplication_IdOrderByScheduledAtAsc(applicationId);
        var interviews = applicationInterviews.stream()
                .map(interview -> {
                    List<UUID> panelIds = interview.getPanelRecruiterIds() == null ? List.of() : interview.getPanelRecruiterIds();
                    List<String> panelNames = panelIds.stream().map(memberNames::get).filter(java.util.Objects::nonNull).toList();
                    var scorecards = interviewScorecardRepository.findByInterview_IdOrderBySubmittedAtDesc(interview.getId()).stream()
                            .map(scorecard -> new RecruiterJobApplicantDetailResponse.Scorecard(scorecard.getId(), scorecard.getRecruiter().getId(),
                                    scorecard.getRecruiter().getFullName(), scorecard.getRecommendation(), scorecard.getScore(),
                                    scorecard.getCriteriaScores() == null ? java.util.Map.of() : scorecard.getCriteriaScores(),
                                    scorecard.getFeedback(), scorecard.getSubmittedAt())).toList();
                    boolean canScore = interview.getRecruiter().getId().equals(recruiterId) || panelIds.contains(recruiterId);
                    return new RecruiterJobApplicantDetailResponse.InterviewSummary(interview.getId(), interview.getPlatformName(),
                            interview.getMeetingLink(), interview.getScheduledAt(), interview.getDurationMinutes(), interview.getTimeZone(),
                            interview.getAgenda(), interview.getStatus().name(), interview.getRecruiter().getId(), interview.getRecruiter().getFullName(),
                            panelIds, panelNames, canScore, scorecards);
                })
                .toList();
        Recruiter assigned = application.getAssignedRecruiter();
        boolean canManage = canManage(application, recruiter);
        return new RecruiterJobApplicantDetailResponse(application.getId(), candidate.getId(), application.getJob().getPublicJobId(),
                application.getJob().getTitle(), candidate.getFullName(), candidate.getHeadline(), candidate.getCurrentCompany(),
                candidate.getPreviousRole(), candidate.getPreviousCompany(), candidate.getDepartmentRole(), candidate.getIndustry(), education,
                candidate.getLocation(), candidate.getPreferredLocations(), candidate.getOverallExperienceYears(), candidate.getExpectedSalaryLakhs(),
                candidate.getNoticePeriodDays(), candidate.getSkills().stream().map(skill -> skill.getSkill()).sorted().toList(),
                candidate.getWorkLinks(), candidate.getProfileSummary(), candidate.isEmailVerified(), candidate.isMobileVerified(),
                candidateParseResultRepository.existsByCandidate_Id(candidate.getId()), maskEmail(candidate.getEmail()), maskMobile(candidate.getMobile()),
                application.getPipelineStage(), application.getApplicationSource().name(),
                application.getReferral() == null ? null : application.getReferral().getReferralCode(), application.getAppliedAt(),
                application.getUpdatedAt(), candidate.getLastActiveAt(), candidate.getUpdatedAt(), application.getRecipientRecruiter().getId(),
                application.getRecipientRecruiter().getFullName(), assigned == null ? application.getRecipientRecruiter().getId() : assigned.getId(),
                assigned == null ? application.getRecipientRecruiter().getFullName() : assigned.getFullName(), canManage,
                organisationMembers.stream().map(member -> new RecruiterJobApplicantDetailResponse.OrganisationMember(member.getId(), member.getFullName(), member.getDesignation())).toList(),
                decisionReadiness(application, applicationInterviews), notes, timeline, interviews);
    }

    @Transactional
    @AuditAction(action = "APPLICATION_OWNER_CHANGED", resourceType = "APPLICATION", resourceIdArgumentIndex = 2)
    public RecruiterJobApplicantDetailResponse assignApplicant(UUID recruiterId, String publicJobId, UUID applicationId, UUID assigneeId) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = applicationForManager(applicationId, recruiter);
        requireJob(application, publicJobId);
        Recruiter assignee = recruiterRepository.findById(assigneeId)
                .filter(member -> member.getOrganisation().getId().equals(recruiter.getOrganisation().getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a recruiter from your organisation."));
        application.setAssignedRecruiter(assignee.getId().equals(application.getRecipientRecruiter().getId()) ? null : assignee);
        applicationRepository.save(application);
        applicationEventService.record(application, "RECRUITER", "APPLICATION_OWNER_CHANGED",
                recruiter.getFullName() + " assigned the application to " + assignee.getFullName() + ".");
        return jobApplicant(recruiterId, publicJobId, applicationId);
    }

    @Transactional
    @AuditAction(action = "APPLICATION_DECISION_POLICY_CHANGED", resourceType = "APPLICATION", resourceIdArgumentIndex = 2)
    public RecruiterJobApplicantDetailResponse updateDecisionPolicy(UUID recruiterId, String publicJobId, UUID applicationId, int requiredApprovals) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = applicationForManager(applicationId, recruiter);
        requireJob(application, publicJobId);
        application.setRequiredOfferApprovals(requiredApprovals);
        applicationRepository.save(application);
        applicationEventService.record(application, "RECRUITER", "APPLICATION_DECISION_POLICY_CHANGED",
                recruiter.getFullName() + " set the offer approval requirement to " + requiredApprovals + ".");
        return jobApplicant(recruiterId, publicJobId, applicationId);
    }

    @Transactional
    @AuditAction(action = "PIPELINE_STAGE_CHANGED", resourceType = "APPLICATION", resourceIdArgumentIndex = 1, candidateIdArgumentIndex = -1)
    public PipelineCandidateResponse moveStage(UUID recruiterId, UUID applicationId, PipelineStage stage) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = applicationForManager(applicationId, recruiter);
        if (stage == PipelineStage.OFFER) {
            RecruiterJobApplicantDetailResponse.DecisionReadiness readiness = decisionReadiness(application,
                    interviewRepository.findByApplication_IdOrderByScheduledAtAsc(applicationId));
            if (!readiness.offerReady()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Offer readiness is incomplete: " + String.join(" ", readiness.blockers()));
            }
        }
        if (stage == PipelineStage.ONBOARDED && !offerService.hasAcceptedOffer(applicationId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The candidate must accept the current offer before being marked as hired.");
        }
        if (stage != PipelineStage.OFFER && stage != PipelineStage.ONBOARDED && offerService.hasBlockingOpenOffer(applicationId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Withdraw the active offer before moving this application to another stage.");
        }
        PipelineStage previous = application.getPipelineStage();
        application.setPipelineStage(stage);
        applicationEventService.record(application, "RECRUITER", "PIPELINE_STAGE_CHANGED", "Application moved from " + human(previous) + " to " + human(stage) + ".");
        notificationService.create(application.getCandidate().getId(), "APPLICATION_STAGE_CHANGED", "Application update",
                "Your application for " + application.getJob().getTitle() + " moved to " + human(stage) + ".", "APPLICATION", application.getId());
        sseNotificationService.publishPipelineUpdate(recruiterId,
                PipelineUpdateEvent.of(application.getJob().getPublicJobId(), application.getCandidate().getId(), human(previous), human(stage)));
        return pipelineResponse(application);
    }

    @Transactional
    @AuditAction(action = "RECRUITER_NOTE_ADDED", resourceType = "APPLICATION", resourceIdArgumentIndex = 1, candidateIdArgumentIndex = -1)
    public PipelineCandidateResponse addNote(UUID recruiterId, UUID applicationId, String note) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = applicationForManager(applicationId, recruiter);
        recruiterNoteRepository.save(RecruiterNote.builder().application(application).recruiter(recruiter).noteText(note.trim()).build());
        applicationEventService.record(application, "RECRUITER", "RECRUITER_NOTE_ADDED", recruiter.getFullName() + " added a recruiter note.");
        return pipelineResponse(application);
    }

    @Transactional(readOnly = true)
    @AuditAction(action = "CANDIDATE_CONTACT_REVEALED", resourceType = "CANDIDATE", resourceIdArgumentIndex = 1, candidateIdArgumentIndex = 1, jobIdArgumentIndex = 3)
    public CandidateContactResponse revealContact(UUID recruiterId, UUID candidateId, ContactChannel channel, String jobId) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = applicationRepository.findByCandidate_IdAndJob_PublicJobId(candidateId, jobId.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Contact details are available only for candidates in the selected job pipeline."));
        if (!canManage(application, recruiter)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the posting recruiter or assigned owner can reveal contact details.");
        Candidate candidate = application.getCandidate();
        return new CandidateContactResponse(candidateId, channel, channel == ContactChannel.EMAIL ? candidate.getEmail() : candidate.getMobile());
    }

    @Transactional(readOnly = true)
    public Page<CandidateSourcingResult> source(UUID recruiterId, RecruiterSourcingRequest request) {
        recruiter(recruiterId);
        try {
            return candidateSourcingService.search(new CandidateSourcingCriteria(request.anyKeywords(), request.allKeywords(), request.excludedKeywords(), request.booleanQuery(),
                    request.minimumExperienceYears(), request.maximumExperienceYears(), request.minimumSalaryLakhs(), request.maximumSalaryLakhs(), request.location(), request.company(), request.designation(), request.departmentRole(), request.industry(),
                    request.bachelorsInstitution(), request.mastersInstitution(), request.qualification(), request.educationTypes(), request.gender(), request.maximumNoticePeriodDays(), request.activeStatus(),
                    request.page() == null ? 0 : request.page(), request.pageSize() == null ? 40 : request.pageSize(), request.domainCategory(), request.requireGithub(), request.requireLeetcode(), request.requirePortfolio()));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, exception.getMessage(), exception);
        }
    }

    @Transactional(readOnly = true)
    public CandidateSourcingProfileResponse sourcedProfile(UUID recruiterId, UUID candidateId) {
        recruiter(recruiterId);
        Candidate candidate = candidate(candidateId);
        if (!candidate.isProfileSearchable()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate profile was not found.");
        }
        String education = candidate.getEducation().stream()
                .max(Comparator.comparing(CandidateEducation::getGraduationYear, Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(value -> value.getDegreeName() + " · " + value.getInstitutionName()
                        + (value.getGraduationYear() == null ? "" : " " + value.getGraduationYear()))
                .orElse("Education not shared");
        return new CandidateSourcingProfileResponse(candidate.getId(), candidate.getFullName(), candidate.getHeadline(), candidate.getCurrentCompany(),
                candidate.getPreviousRole(), candidate.getPreviousCompany(), education, candidate.getLocation(), candidate.getPreferredLocations(),
                candidate.getOverallExperienceYears(), candidate.getExpectedSalaryLakhs(), candidate.getNoticePeriodDays(),
                candidate.getSkills().stream().map(skill -> skill.getSkill()).sorted().toList(), candidate.getProfileSummary(), candidate.isEmailVerified(),
                candidate.isMobileVerified(), candidateParseResultRepository.existsByCandidate_Id(candidateId),
                candidateRepository.countByProfileSearchableTrueAndDomainCategoryAndIdNot(candidate.getDomainCategory(), candidateId),
                candidateProfileEngagementRepository.viewCount(candidateId), candidateProfileEngagementRepository.downloadCount(candidateId),
                candidate.getLastActiveAt(), candidate.getUpdatedAt());
    }

    @Transactional
    @AuditAction(action = "CANDIDATE_PROFILE_VIEWED", resourceType = "CANDIDATE", resourceIdArgumentIndex = 1, candidateIdArgumentIndex = 1)
    public void recordSourcedProfileView(UUID recruiterId, UUID candidateId) {
        recruiter(recruiterId);
        candidate(candidateId);
        candidateProfileEngagementRepository.recordView(candidateId, recruiterId);
    }

    @Transactional
    @AuditAction(action = "CANDIDATE_PROFILE_DOWNLOADED", resourceType = "CANDIDATE", resourceIdArgumentIndex = 1, candidateIdArgumentIndex = 1)
    public void recordSourcedProfileDownload(UUID recruiterId, UUID candidateId) {
        recruiter(recruiterId);
        candidate(candidateId);
        if (!candidateParseResultRepository.existsByCandidate_Id(candidateId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This candidate has not attached a CV.");
        }
        candidateProfileEngagementRepository.recordDownload(candidateId, recruiterId);
    }

    @Transactional
    @AuditAction(action = "INTERVIEW_INVITE_CREATED", resourceType = "APPLICATION", resourceIdArgumentIndex = 1, candidateIdArgumentIndex = -1)
    public RecruiterDashboardResponse.UpcomingInterview schedule(UUID recruiterId, InterviewRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = applicationForManager(request.applicationId(), recruiter);
        Instant requestedEnd = request.scheduledAt().plus(request.durationMinutes(), java.time.temporal.ChronoUnit.MINUTES);
        boolean conflict = interviewRepository.findByRecruiter_IdAndScheduledAtAfterOrderByScheduledAtAsc(recruiterId,
                        request.scheduledAt().minus(1, java.time.temporal.ChronoUnit.DAYS), PageRequest.of(0, 200)).stream()
                .filter(value -> value.getStatus() != InterviewStatus.CANCELLED)
                .anyMatch(value -> value.getScheduledAt().isBefore(requestedEnd)
                        && value.getScheduledAt().plus(value.getDurationMinutes(), java.time.temporal.ChronoUnit.MINUTES).isAfter(request.scheduledAt()));
        if (conflict) throw new ResponseStatusException(HttpStatus.CONFLICT, "This recruiter already has an interview during the selected time.");
        List<UUID> panelIds = request.panelRecruiterIds() == null ? List.of() : request.panelRecruiterIds().stream().filter(java.util.Objects::nonNull).distinct().limit(12).toList();
        List<Recruiter> panel = recruiterRepository.findAllById(panelIds);
        if (panel.size() != panelIds.size() || panel.stream().anyMatch(member -> !member.getOrganisation().getId().equals(recruiter.getOrganisation().getId())))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Every interviewer must belong to your organisation.");
        Interview interview = interviewRepository.save(Interview.builder().application(application).recruiter(recruiter).platformName(request.platformName().trim())
                .meetingLink(validatedMeetingLink(request.meetingLink())).scheduledAt(request.scheduledAt()).durationMinutes(request.durationMinutes())
                .timeZone(request.timeZone() == null || request.timeZone().isBlank() ? "UTC" : request.timeZone().trim())
                .agenda(request.agenda() == null || request.agenda().isBlank() ? null : request.agenda().trim()).panelRecruiterIds(panelIds)
                .status(InterviewStatus.SCHEDULED).build());
        String panelNames = panel.stream().map(Recruiter::getFullName).sorted().collect(java.util.stream.Collectors.joining(", "));
        applicationEventService.record(application, "RECRUITER", "INTERVIEW_SCHEDULED", recruiter.getFullName() + " scheduled an interview for "
                + request.scheduledAt() + " on " + request.platformName().trim() + (panelNames.isBlank() ? "." : " with " + panelNames + "."));
        notificationService.create(application.getCandidate().getId(), "INTERVIEW_SCHEDULED", "Interview scheduled",
                "An interview for " + application.getJob().getTitle() + " is scheduled on " + request.scheduledAt() + ".", "INTERVIEW", interview.getId());
        return new RecruiterDashboardResponse.UpcomingInterview(application.getCandidate().getFullName(), application.getJob().getTitle(), interview.getPlatformName(), interview.getMeetingLink(), interview.getScheduledAt(), interview.getDurationMinutes());
    }

    private Recruiter recruiter(UUID recruiterId) { return recruiterRepository.findById(recruiterId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter profile was not found.")); }
    private Candidate candidate(UUID candidateId) { return candidateRepository.findById(candidateId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate profile was not found.")); }
    private JobApplication applicationVisibleToRecruiter(UUID applicationId, Recruiter recruiter) {
        JobApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate application was not found."));
        boolean sameOrganisation = application.getJob().getOrganisation().getId().equals(recruiter.getOrganisation().getId());
        boolean panelMember = sameOrganisation && interviewRepository.findByApplication_IdOrderByScheduledAtAsc(applicationId).stream()
                .anyMatch(interview -> interview.getPanelRecruiterIds() != null && interview.getPanelRecruiterIds().contains(recruiter.getId()));
        if (!sameOrganisation || (!canManage(application, recruiter) && !panelMember)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate application was not found.");
        }
        return application;
    }
    private JobApplication applicationForManager(UUID applicationId, Recruiter recruiter) {
        JobApplication application = applicationVisibleToRecruiter(applicationId, recruiter);
        if (!canManage(application, recruiter)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the posting recruiter or assigned owner can manage this application.");
        return application;
    }
    private boolean canManage(JobApplication application, Recruiter recruiter) {
        return application.getRecipientRecruiter().getId().equals(recruiter.getId())
                || application.getAssignedRecruiter() != null && application.getAssignedRecruiter().getId().equals(recruiter.getId());
    }
    private void requireJob(JobApplication application, String publicJobId) {
        if (publicJobId == null || !application.getJob().getPublicJobId().equalsIgnoreCase(publicJobId.trim())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate application was not found for this job.");
        }
    }
    private RecruiterJobApplicantDetailResponse.DecisionReadiness decisionReadiness(JobApplication application, List<Interview> interviews) {
        List<Interview> activeInterviews = interviews.stream().filter(interview -> interview.getStatus() != InterviewStatus.CANCELLED).toList();
        java.util.LinkedHashMap<UUID, String> expectedReviewers = new java.util.LinkedHashMap<>();
        activeInterviews.forEach(interview -> {
            expectedReviewers.put(interview.getRecruiter().getId(), interview.getRecruiter().getFullName());
            List<UUID> panelIds = interview.getPanelRecruiterIds() == null ? List.of() : interview.getPanelRecruiterIds();
            recruiterRepository.findAllById(panelIds).forEach(member -> expectedReviewers.put(member.getId(), member.getFullName()));
        });
        java.util.LinkedHashMap<UUID, com.sapienworx.api.workflow.InterviewScorecard> latestByReviewer = new java.util.LinkedHashMap<>();
        activeInterviews.forEach(interview -> interviewScorecardRepository.findByInterview_IdOrderBySubmittedAtDesc(interview.getId())
                .forEach(scorecard -> latestByReviewer.merge(scorecard.getRecruiter().getId(), scorecard, (current, candidate) -> {
                    if (current.getSubmittedAt() == null) return candidate;
                    if (candidate.getSubmittedAt() == null) return current;
                    return candidate.getSubmittedAt().isAfter(current.getSubmittedAt()) ? candidate : current;
                })));
        List<String> missing = expectedReviewers.entrySet().stream().filter(entry -> !latestByReviewer.containsKey(entry.getKey()))
                .map(java.util.Map.Entry::getValue).sorted().toList();
        int positive = (int) latestByReviewer.values().stream().filter(scorecard ->
                "YES".equals(scorecard.getRecommendation()) || "STRONG_YES".equals(scorecard.getRecommendation())).count();
        boolean hasNegative = latestByReviewer.values().stream().anyMatch(scorecard ->
                "NO".equals(scorecard.getRecommendation()) || "STRONG_NO".equals(scorecard.getRecommendation()));
        boolean conflict = positive > 0 && hasNegative;
        Double average = latestByReviewer.isEmpty() ? null : Math.round(latestByReviewer.values().stream()
                .mapToInt(com.sapienworx.api.workflow.InterviewScorecard::getScore).average().orElse(0) * 10.0) / 10.0;
        java.util.ArrayList<String> blockers = new java.util.ArrayList<>();
        if (activeInterviews.isEmpty()) blockers.add("Schedule at least one interview before creating an offer.");
        if (!missing.isEmpty()) blockers.add("Waiting for feedback from " + String.join(", ", missing) + ".");
        if (positive < application.getRequiredOfferApprovals()) blockers.add("Need " + application.getRequiredOfferApprovals()
                + " positive approval" + (application.getRequiredOfferApprovals() == 1 ? "" : "s") + "; currently " + positive + ".");
        if (conflict) blockers.add("Resolve the disagreement between positive and negative recommendations.");
        if (average == null || average < 3.0) blockers.add("The average interview score must be at least 3.0/5.");
        return new RecruiterJobApplicantDetailResponse.DecisionReadiness(application.getRequiredOfferApprovals(), expectedReviewers.size(),
                latestByReviewer.size(), positive, average, missing, conflict, blockers.isEmpty(), List.copyOf(blockers));
    }
    private PipelineCandidateResponse pipelineResponse(JobApplication application) {
        Candidate candidate = application.getCandidate();
        return new PipelineCandidateResponse(application.getId(), candidate.getId(), candidate.getFullName(), candidate.getHeadline(), application.getJob().getPublicJobId(), application.getJob().getTitle(),
                candidate.getSkills().stream().map(skill -> skill.getSkill()).sorted().toList(), maskEmail(candidate.getEmail()), maskMobile(candidate.getMobile()), application.getPipelineStage(),
                recruiterNoteRepository.findTop10ByApplication_IdOrderByUpdatedAtDesc(application.getId()).stream().map(note -> note.getNoteText()).toList(), candidate.getUpdatedAt(), candidate.getLastActiveAt(),
                application.getApplicationSource().name(), application.getReferral() == null ? null : application.getReferral().getReferralCode());
    }
    private String human(PipelineStage stage) { return stage.name().toLowerCase(java.util.Locale.ROOT).replace('_', ' '); }
    private String validatedMeetingLink(String value) {
        try {
            var uri = java.net.URI.create(value.trim());
            if (uri.getHost() == null || !("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))) {
                throw new IllegalArgumentException();
            }
            return uri.toString();
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Enter a valid HTTPS meeting link.");
        }
    }
    private String maskEmail(String value) { int at = value.indexOf('@'); return at < 1 ? "••••" : value.substring(0, 1) + "••••@" + value.substring(at + 1); }
    private String maskMobile(String value) { return value == null || value.length() < 4 ? "••••" : "+••••••" + value.substring(value.length() - 3); }
}

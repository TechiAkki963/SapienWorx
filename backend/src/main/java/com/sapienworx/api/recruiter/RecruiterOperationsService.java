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
import com.sapienworx.api.workflow.ApplicationEventService;
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

    @Transactional(readOnly = true)
    public RecruiterDashboardResponse dashboard(UUID recruiterId) {
        Recruiter recruiter = recruiter(recruiterId);
        UUID organisationId = recruiter.getOrganisation().getId();
        Map<PipelineStage, Long> funnel = new EnumMap<>(PipelineStage.class);
        for (PipelineStage stage : PipelineStage.values()) funnel.put(stage, applicationRepository.countByRecipientRecruiter_IdAndPipelineStage(recruiterId, stage));
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

    @Transactional
    @AuditAction(action = "PIPELINE_STAGE_CHANGED", resourceType = "APPLICATION", resourceIdArgumentIndex = 1, candidateIdArgumentIndex = -1)
    public PipelineCandidateResponse moveStage(UUID recruiterId, UUID applicationId, PipelineStage stage) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = applicationForRecruiter(applicationId, recruiter);
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
        JobApplication application = applicationForRecruiter(applicationId, recruiter);
        recruiterNoteRepository.save(RecruiterNote.builder().application(application).recruiter(recruiter).noteText(note.trim()).build());
        return pipelineResponse(application);
    }

    @Transactional(readOnly = true)
    @AuditAction(action = "CANDIDATE_CONTACT_REVEALED", resourceType = "CANDIDATE", resourceIdArgumentIndex = 1, candidateIdArgumentIndex = 1, jobIdArgumentIndex = 3)
    public CandidateContactResponse revealContact(UUID recruiterId, UUID candidateId, ContactChannel channel, String jobId) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = applicationRepository.findByCandidate_IdAndRecipientRecruiter_IdAndJob_PublicJobId(candidateId, recruiterId, jobId.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Contact details are available only for candidates in the selected job pipeline."));
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
        JobApplication application = applicationForRecruiter(request.applicationId(), recruiter);
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
                .meetingLink(request.meetingLink().trim()).scheduledAt(request.scheduledAt()).durationMinutes(request.durationMinutes())
                .timeZone(request.timeZone() == null || request.timeZone().isBlank() ? "UTC" : request.timeZone().trim())
                .agenda(request.agenda() == null || request.agenda().isBlank() ? null : request.agenda().trim()).panelRecruiterIds(panelIds)
                .status(InterviewStatus.SCHEDULED).build());
        applicationEventService.record(application, "RECRUITER", "INTERVIEW_SCHEDULED", "Interview scheduled for " + request.scheduledAt() + " on " + request.platformName().trim() + ".");
        notificationService.create(application.getCandidate().getId(), "INTERVIEW_SCHEDULED", "Interview scheduled",
                "An interview for " + application.getJob().getTitle() + " is scheduled on " + request.scheduledAt() + ".", "INTERVIEW", interview.getId());
        return new RecruiterDashboardResponse.UpcomingInterview(application.getCandidate().getFullName(), application.getJob().getTitle(), interview.getPlatformName(), interview.getMeetingLink(), interview.getScheduledAt(), interview.getDurationMinutes());
    }

    private Recruiter recruiter(UUID recruiterId) { return recruiterRepository.findById(recruiterId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter profile was not found.")); }
    private Candidate candidate(UUID candidateId) { return candidateRepository.findById(candidateId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate profile was not found.")); }
    private JobApplication applicationForRecruiter(UUID applicationId, Recruiter recruiter) { return applicationRepository.findByIdAndRecipientRecruiter_Id(applicationId, recruiter.getId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate application was not found.")); }
    private PipelineCandidateResponse pipelineResponse(JobApplication application) {
        Candidate candidate = application.getCandidate();
        return new PipelineCandidateResponse(application.getId(), candidate.getId(), candidate.getFullName(), candidate.getHeadline(), application.getJob().getPublicJobId(), application.getJob().getTitle(),
                candidate.getSkills().stream().map(skill -> skill.getSkill()).sorted().toList(), maskEmail(candidate.getEmail()), maskMobile(candidate.getMobile()), application.getPipelineStage(),
                recruiterNoteRepository.findTop10ByApplication_IdOrderByUpdatedAtDesc(application.getId()).stream().map(note -> note.getNoteText()).toList(), candidate.getUpdatedAt(), candidate.getLastActiveAt(),
                application.getApplicationSource().name(), application.getReferral() == null ? null : application.getReferral().getReferralCode());
    }
    private String human(PipelineStage stage) { return stage.name().toLowerCase(java.util.Locale.ROOT).replace('_', ' '); }
    private String maskEmail(String value) { int at = value.indexOf('@'); return at < 1 ? "••••" : value.substring(0, 1) + "••••@" + value.substring(at + 1); }
    private String maskMobile(String value) { return value == null || value.length() < 4 ? "••••" : "+••••••" + value.substring(value.length() - 3); }
}

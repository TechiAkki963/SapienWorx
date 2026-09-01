package com.sapienworx.api.candidate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.application.ApplicationSource;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.communication.DirectMessageRepository;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobResponse;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.CandidateEngagementMetrics;
import com.sapienworx.api.recruiter.CandidateProfileEngagementRepository;
import com.sapienworx.api.interview.InterviewRepository;
import com.sapienworx.api.workflow.ApplicationEventRepository;
import com.sapienworx.api.workflow.ApplicationEventService;
import com.sapienworx.api.workflow.CandidateContactPreference;
import com.sapienworx.api.workflow.CandidateContactPreferenceRepository;
import com.sapienworx.api.workflow.JobReferral;
import com.sapienworx.api.workflow.JobReferralRepository;
import com.sapienworx.api.admin.PlatformPrivacyCase;
import com.sapienworx.api.admin.PlatformPrivacyCaseRepository;
import com.sapienworx.api.admin.PrivacyCaseStatus;
import com.sapienworx.api.admin.PrivacyCaseType;
import com.sapienworx.api.admin.PrivacyConsentEvidence;
import com.sapienworx.api.admin.PrivacyConsentEvidenceRepository;
import com.sapienworx.api.cvparser.CandidateParseResultRepository;
import com.sapienworx.api.cvparser.CvDocumentStorage;
import com.sapienworx.api.workflow.WorkflowRequests;
import com.sapienworx.api.workflow.WorkflowResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CandidateWorkspaceService {
    private static final Set<String> SUPPORTED_INTERESTED_DOMAINS = Set.of(
            "Technology", "IT Services", "Manufacturing & Production", "Healthcare & Life Sciences",
            "Infrastructure, Transport & Real Estate", "BFSI", "BPM", "Consumer, Retail & Hospitality",
            "Media, Entertainment & Telecom", "Education"
    );
    private final CandidateRepository candidateRepository;
    private final JobRepository jobRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final CandidateProfileEngagementRepository candidateProfileEngagementRepository;
    private final NotificationService notificationService;
    private final DirectMessageRepository directMessageRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventService applicationEventService;
    private final ApplicationEventRepository applicationEventRepository;
    private final InterviewRepository interviewRepository;
    private final CandidateContactPreferenceRepository contactPreferenceRepository;
    private final JobReferralRepository jobReferralRepository;
    private final PlatformPrivacyCaseRepository platformPrivacyCaseRepository;
    private final SavedJobRepository savedJobRepository;
    private final CandidateParseResultRepository candidateParseResultRepository;
    private final CvDocumentStorage cvDocumentStorage;
    private final PrivacyConsentEvidenceRepository consentEvidenceRepository;

    @Transactional
    public CandidateProfileResponse profile(UUID candidateId) {
        Candidate candidate = candidate(candidateId);
        candidate.setLastActiveAt(Instant.now());
        return response(candidate);
    }

    @Transactional
    @AuditAction(action = "CANDIDATE_PROFILE_UPDATED", resourceType = "CANDIDATE", resourceIdArgumentIndex = 0, candidateIdArgumentIndex = 0)
    public CandidateProfileResponse updateProfile(UUID candidateId, CandidateProfileRequest request) {
        Candidate candidate = candidate(candidateId);
        candidate.setHeadline(trimToNull(request.headline()));
        candidate.setCurrentCompany(trimToNull(request.currentCompany()));
        candidate.setDepartmentRole(trimToNull(request.departmentRole()));
        candidate.setIndustry(trimToNull(request.industry()));
        candidate.setPreviousRole(trimToNull(request.previousRole()));
        candidate.setPreviousCompany(trimToNull(request.previousCompany()));
        candidate.setLocation(trimToNull(request.location()));
        candidate.setPreferredLocations(normalizedValues(request.preferredLocations()));
        candidate.setOverallExperienceYears(request.overallExperienceYears());
        candidate.setExpectedSalaryLakhs(request.expectedSalaryLakhs());
        candidate.setNoticePeriodDays(request.noticePeriodDays());
        candidate.setGender(normalizedGender(request.gender()));
        candidate.setProfileSummary(trimToNull(request.profileSummary()));
        candidate.setProfileSearchable(request.profileSearchable());
        if (request.interestedDomains() != null) candidate.setInterestedDomains(normalizedInterestedDomains(request.interestedDomains()));
        candidate.setWorkLinks(request.workLinks() == null ? List.of() : request.workLinks().stream().filter(link -> link != null && !link.isBlank()).map(String::trim).toList());
        if (request.profileDetails() != null) {
            boolean includesSensitiveData = hasSensitiveProfileData(request.profileDetails());
            if (includesSensitiveData && !candidate.isSensitiveDataConsent() && !Boolean.TRUE.equals(request.sensitiveDataConsent())) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Review the optional sensitive-data notice and confirm consent before saving diversity or personal details.");
            }
            if (Boolean.TRUE.equals(request.sensitiveDataConsent()) && !candidate.isSensitiveDataConsent()) {
                candidate.setSensitiveDataConsent(true);
                consentEvidenceRepository.save(PrivacyConsentEvidence.builder().subjectType("CANDIDATE").subjectId(candidateId)
                        .purpose("OPTIONAL_SENSITIVE_PROFILE").lawfulBasis("EXPLICIT_CONSENT").noticeVersion("2026-08-31")
                        .noticeLanguage("en-IN").affirmativeAction(true).recordedAt(Instant.now()).build());
            }
            candidate.setProfileDetails(objectMapper.valueToTree(request.profileDetails()));
        }
        if (request.skills() != null) {
            candidate.getSkills().clear();
            request.skills().forEach(skill -> candidate.getSkills().add(CandidateSkill.builder().candidate(candidate)
                    .skill(skill.skill().trim()).rating(skill.rating()).yearsOfExperience(skill.yearsOfExperience())
                    .experienceMonths(skill.experienceMonths()).softwareVersion(trimToNull(skill.softwareVersion())).lastUsedYear(skill.lastUsedYear()).build()));
        }
        if (request.education() != null) {
            candidate.getEducation().clear();
            request.education().forEach(education -> candidate.getEducation().add(CandidateEducation.builder().candidate(candidate)
                    .level(education.level()).degreeName(education.degreeName().trim()).institutionName(education.institutionName().trim())
                    .graduationYear(education.graduationYear()).courseStartYear(education.courseStartYear()).specialization(trimToNull(education.specialization())).studyType(normalizedStudyType(education.studyType()))
                    .grade(trimToNull(education.grade())).build()));
        }
        if (candidate.isProfileSearchable()) ensureSearchReady(candidate);
        candidate.setLastActiveAt(Instant.now());
        return response(candidate);
    }

    @Transactional
    @AuditAction(action = "APPLICATION_SUBMITTED", resourceType = "APPLICATION", candidateIdArgumentIndex = 0, jobIdArgumentIndex = 1)
    public CandidateApplicationResponse apply(UUID candidateId, String publicJobId, CandidateApplicationRequest request) {
        Candidate candidate = candidate(candidateId);
        if (candidate.isDeletionRequested()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Your account has a pending deletion request, so new applications are disabled.");
        }
        Job job = jobRepository.findByPublicJobId(publicJobId).filter(value -> value.getStatus() == JobStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published job was not found."));
        if (jobApplicationRepository.existsByCandidate_IdAndJob_InternalId(candidateId, job.getInternalId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already applied for this job.");
        }
        Recruiter recipient = job.getCreatedByRecruiter();
        if (recipient == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This job is not assigned to a hiring recruiter yet.");
        }
        if (recipient.getOrganisation() == null || !recipient.getOrganisation().getId().equals(job.getOrganisation().getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The job owner is not part of the posting organisation.");
        }
        ApplicationAttribution attribution = applicationAttribution(candidate, job, request.referralCode(), request.source());
        JobApplication application;
        try {
            application = jobApplicationRepository.saveAndFlush(JobApplication.builder().candidate(candidate).job(job)
                    .recipientRecruiter(recipient).referral(attribution.referral()).applicationSource(attribution.source())
                    .coverLetter(trimToNull(request.coverLetter())).pipelineStage(PipelineStage.APPLIED).build());
        } catch (DataIntegrityViolationException duplicateRace) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already applied for this job.");
        }
        applicationEventService.record(application, "CANDIDATE", "APPLICATION_SUBMITTED", "Application submitted to " + job.getOrganisation().getName() + ".");
        preserveLegacyReferralAttribution(attribution.referral(), candidate);
        notificationService.create(recipient.getId(), "NEW_APPLICATION", "New application for " + job.getTitle(),
                candidate.getFullName() + " has applied.", "APPLICATION", application.getId());
        return applicationResponse(application);
    }

    @Transactional(readOnly = true)
    public Page<CandidateApplicationResponse> applications(UUID candidateId, Pageable pageable) {
        return jobApplicationRepository.findByCandidate_Id(candidateId, pageable).map(this::applicationResponse);
    }

    @Transactional(readOnly = true)
    public CandidateApplicationSummaryResponse applicationSummary(UUID candidateId) {
        long total = jobApplicationRepository.countByCandidate_Id(candidateId);
        long active = jobApplicationRepository.countByCandidate_IdAndPipelineStageIn(candidateId,
                List.of(PipelineStage.APPLIED, PipelineStage.SCREENING, PipelineStage.INTERVIEWING, PipelineStage.FINAL_STAGE));
        long interviews = jobApplicationRepository.countByCandidate_IdAndPipelineStageIn(candidateId, List.of(PipelineStage.INTERVIEWING));
        long offers = jobApplicationRepository.countByCandidate_IdAndPipelineStageIn(candidateId, List.of(PipelineStage.OFFER));
        return new CandidateApplicationSummaryResponse(total, active, interviews, offers);
    }

    @Transactional(readOnly = true)
    public List<SavedJobResponse> savedJobs(UUID candidateId) {
        candidate(candidateId);
        return savedJobRepository.findByCandidate_IdOrderBySavedAtDesc(candidateId).stream().map(SavedJobResponse::from).toList();
    }

    @Transactional
    @AuditAction(action = "CANDIDATE_JOB_SAVED", resourceType = "JOB", candidateIdArgumentIndex = 0, jobIdArgumentIndex = 1)
    public SavedJobResponse saveJob(UUID candidateId, String publicJobId) {
        Candidate candidate = candidate(candidateId);
        if (candidate.isDeletionRequested()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Your account has a pending deletion request, so jobs cannot be saved.");
        }
        Job job = jobRepository.findByPublicJobId(publicJobId).filter(value -> value.getStatus() == JobStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published job was not found."));
        SavedJob existing = savedJobRepository.findByCandidate_IdAndJob_InternalId(candidateId, job.getInternalId()).orElse(null);
        if (existing != null) return SavedJobResponse.from(existing);
        try {
            return SavedJobResponse.from(savedJobRepository.saveAndFlush(SavedJob.builder().candidate(candidate).job(job).build()));
        } catch (DataIntegrityViolationException duplicateRace) {
            return savedJobRepository.findByCandidate_IdAndJob_InternalId(candidateId, job.getInternalId())
                    .map(SavedJobResponse::from)
                    .orElseThrow(() -> duplicateRace);
        }
    }

    @Transactional
    @AuditAction(action = "CANDIDATE_JOB_UNSAVED", resourceType = "JOB", candidateIdArgumentIndex = 0, jobIdArgumentIndex = 1)
    public void removeSavedJob(UUID candidateId, String publicJobId) {
        candidate(candidateId);
        Job job = jobRepository.findByPublicJobId(publicJobId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job was not found."));
        savedJobRepository.deleteByCandidate_IdAndJob_InternalId(candidateId, job.getInternalId());
    }

    @Transactional(readOnly = true)
    public WorkflowResponses.ApplicationTimeline applicationTimeline(UUID candidateId, UUID applicationId) {
        JobApplication application = jobApplicationRepository.findById(applicationId)
                .filter(value -> value.getCandidate().getId().equals(candidateId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application was not found."));
        List<WorkflowResponses.TimelineEvent> events = applicationEventRepository.findByApplication_IdOrderByCreatedAtAsc(applicationId).stream()
                .map(event -> new WorkflowResponses.TimelineEvent(event.getEventType(), event.getEventSummary(), event.getCreatedAt())).toList();
        List<WorkflowResponses.Interview> interviews = interviewRepository.findByApplication_IdOrderByScheduledAtAsc(applicationId).stream()
                .map(interview -> new WorkflowResponses.Interview(interview.getId(), applicationId, application.getCandidate().getFullName(), application.getJob().getTitle(),
                        interview.getPlatformName(), interview.getMeetingLink(), interview.getScheduledAt(), interview.getDurationMinutes(), interview.getTimeZone(), interview.getAgenda(),
                        interview.getPanelRecruiterIds() == null ? List.of() : interview.getPanelRecruiterIds(), List.of(), interview.getStatus(), List.of())).toList();
        return new WorkflowResponses.ApplicationTimeline(applicationId, application.getPipelineStage(), nextStep(application.getPipelineStage()), events, interviews);
    }

    @Transactional
    @AuditAction(action = "JOB_SHARED", resourceType = "JOB", candidateIdArgumentIndex = 0, jobIdArgumentIndex = 1)
    public WorkflowResponses.Referral createReferral(UUID candidateId, String publicJobId) {
        Candidate candidate = candidate(candidateId);
        Job job = jobRepository.findByPublicJobId(publicJobId).filter(value -> value.getStatus() == JobStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published job was not found."));
        JobReferral referral = jobReferralRepository.findByJob_InternalIdAndReferrerCandidate_Id(job.getInternalId(), candidateId)
                .orElseGet(() -> jobReferralRepository.save(JobReferral.builder().job(job).referrerCandidate(candidate)
                        .referralCode("SWX-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase(java.util.Locale.ROOT)).build()));
        long applicationsAttributed = jobApplicationRepository.countByReferral_Id(referral.getId());
        String separator = JobResponse.from(job).publicPath().contains("?") ? "&" : "?";
        String shareUrl = JobResponse.from(job).publicPath() + separator + "ref=" + referral.getReferralCode() + "&source=candidate_share";
        return new WorkflowResponses.Referral(referral.getReferralCode(), shareUrl, Math.toIntExact(Math.min(Integer.MAX_VALUE, applicationsAttributed)));
    }

    @Transactional(readOnly = true)
    public WorkflowResponses.CandidatePrivacy privacy(UUID candidateId) {
        Candidate candidate = candidate(candidateId);
        return privacyResponse(candidate, contactPreferenceRepository.findById(candidateId).orElse(null));
    }

    @Transactional
    @AuditAction(action = "CANDIDATE_PRIVACY_UPDATED", resourceType = "PRIVACY", resourceIdArgumentIndex = 0, candidateIdArgumentIndex = 0)
    public WorkflowResponses.CandidatePrivacy updatePrivacy(UUID candidateId, WorkflowRequests.CandidatePrivacyUpdateRequest request) {
        Candidate candidate = candidate(candidateId);
        if (request.profileSearchable() != null) {
            candidate.setProfileSearchable(request.profileSearchable());
            if (candidate.isProfileSearchable()) ensureSearchReady(candidate);
        }
        if (request.automationConsent() != null) candidate.setAutomationConsent(request.automationConsent());
        if (request.sensitiveDataConsent() != null) {
            candidate.setSensitiveDataConsent(request.sensitiveDataConsent());
            if (request.sensitiveDataConsent()) {
                consentEvidenceRepository.save(PrivacyConsentEvidence.builder().subjectType("CANDIDATE").subjectId(candidateId)
                        .purpose("OPTIONAL_SENSITIVE_PROFILE").lawfulBasis("EXPLICIT_CONSENT").noticeVersion("2026-08-31")
                        .noticeLanguage("en-IN").affirmativeAction(true).recordedAt(Instant.now()).build());
            } else {
                candidate.setProfileDetails(scrubSensitiveProfileData(candidate.getProfileDetails()));
                PrivacyConsentEvidence evidence = consentEvidenceRepository.findTopBySubjectIdAndPurposeAndWithdrawnAtIsNullOrderByRecordedAtDesc(candidateId, "OPTIONAL_SENSITIVE_PROFILE");
                if (evidence != null) evidence.setWithdrawnAt(Instant.now());
            }
        }
        CandidateContactPreference preference = contactPreferenceRepository.findById(candidateId).orElseGet(() -> CandidateContactPreference.builder().candidate(candidate).build());
        if (request.outreachOptOut() != null) preference.setOutreachOptOut(request.outreachOptOut());
        preference = contactPreferenceRepository.save(preference);
        return privacyResponse(candidate, preference);
    }

    @Transactional
    @AuditAction(action = "CANDIDATE_DATA_EXPORT_REQUESTED", resourceType = "PRIVACY", resourceIdArgumentIndex = 0, candidateIdArgumentIndex = 0)
    public WorkflowResponses.CandidatePrivacy requestDataExport(UUID candidateId) {
        Candidate candidate = candidate(candidateId);
        CandidateContactPreference preference = contactPreferenceRepository.findById(candidateId).orElseGet(() -> CandidateContactPreference.builder().candidate(candidate).build());
        preference.setDataExportRequestedAt(Instant.now());
        preference = contactPreferenceRepository.save(preference);
        recordPrivacyCase(candidate, PrivacyCaseType.EXPORT, preference.getDataExportRequestedAt());
        return privacyResponse(candidate, preference);
    }

    @Transactional(readOnly = true)
    @AuditAction(action = "CANDIDATE_DATA_EXPORT_DOWNLOADED", resourceType = "PRIVACY", resourceIdArgumentIndex = 0, candidateIdArgumentIndex = 0)
    public Map<String, Object> dataExport(UUID candidateId) {
        Candidate candidate = candidate(candidateId);
        Map<String, Object> export = new LinkedHashMap<>();
        export.put("exportedAt", Instant.now().toString());
        export.put("account", Map.of("id", candidate.getId(), "fullName", candidate.getFullName(), "email", candidate.getEmail(),
                "mobile", candidate.getMobile(), "emailVerified", candidate.isEmailVerified(), "mobileVerified", candidate.isMobileVerified(),
                "createdAt", candidate.getCreatedAt(), "updatedAt", candidate.getUpdatedAt()));
        export.put("profile", Map.of("headline", value(candidate.getHeadline()), "currentCompany", value(candidate.getCurrentCompany()),
                "location", value(candidate.getLocation()), "overallExperienceYears", candidate.getOverallExperienceYears() == null ? 0 : candidate.getOverallExperienceYears(),
                "noticePeriodDays", candidate.getNoticePeriodDays() == null ? 0 : candidate.getNoticePeriodDays(), "profileDetails", candidate.getProfileDetails()));
        export.put("skills", candidate.getSkills().stream().map(skill -> Map.of("skill", skill.getSkill(), "rating", skill.getRating(),
                "yearsOfExperience", skill.getYearsOfExperience() == null ? 0 : skill.getYearsOfExperience(), "experienceMonths", skill.getExperienceMonths() == null ? 0 : skill.getExperienceMonths())).toList());
        export.put("education", candidate.getEducation().stream().map(education -> Map.of("level", education.getLevel(), "degreeName", education.getDegreeName(), "institutionName", education.getInstitutionName(),
                "graduationYear", education.getGraduationYear() == null ? 0 : education.getGraduationYear(), "specialization", value(education.getSpecialization()))).toList());
        export.put("choices", privacyResponse(candidate, contactPreferenceRepository.findById(candidateId).orElse(null)));
        export.put("applications", jobApplicationRepository.findAllByCandidate_IdOrderByAppliedAtDesc(candidateId).stream().map(application -> Map.of(
                "applicationId", application.getId(), "jobId", application.getJob().getPublicJobId(), "jobTitle", application.getJob().getTitle(),
                "stage", application.getPipelineStage(), "source", application.getApplicationSource(), "appliedAt", value(application.getAppliedAt()), "updatedAt", value(application.getUpdatedAt()))).toList());
        export.put("messages", directMessageRepository.findBySenderIdOrRecipientIdOrderBySentAtDesc(candidateId, candidateId).stream().map(message -> Map.of(
                "messageId", message.getId(), "senderId", message.getSenderId(), "recipientId", message.getRecipientId(), "body", message.getBody(),
                "sentAt", value(message.getSentAt()), "readAt", value(message.getReadAt()))).toList());
        return export;
    }

    @Transactional
    @AuditAction(action = "CANDIDATE_DATA_ERASURE_REQUESTED", resourceType = "PRIVACY", resourceIdArgumentIndex = 0, candidateIdArgumentIndex = 0)
    public WorkflowResponses.CandidatePrivacy requestDeletion(UUID candidateId) {
        Candidate candidate = candidate(candidateId);
        candidate.setDeletionRequested(true);
        CandidateContactPreference preference = contactPreferenceRepository.findById(candidateId).orElseGet(() -> CandidateContactPreference.builder().candidate(candidate).build());
        preference.setDeletionRequestedAt(Instant.now());
        preference = contactPreferenceRepository.save(preference);
        recordPrivacyCase(candidate, PrivacyCaseType.ERASURE, preference.getDeletionRequestedAt());
        return privacyResponse(candidate, preference);
    }

    @Transactional(readOnly = true)
    public CandidateDashboardResponse dashboard(UUID candidateId, int requestedRangeDays) {
        Candidate candidate = candidate(candidateId);
        int rangeDays = java.util.Set.of(7, 30, 90).contains(requestedRangeDays) ? requestedRangeDays : 90;
        Instant now = Instant.now();
        Instant currentPeriodStart = now.minus(java.time.Duration.ofDays(rangeDays));
        CandidateEngagementMetrics engagement = candidateProfileEngagementRepository.metrics(candidateId, currentPeriodStart,
                currentPeriodStart.minus(java.time.Duration.ofDays(rangeDays)));
        long totalActions = engagement.totalViews() + engagement.totalDownloads();
        long currentActions = engagement.currentViews() + engagement.currentDownloads();
        long previousActions = engagement.previousViews() + engagement.previousDownloads();
        List<CandidateDashboardResponse.RecruiterActivity> activity = candidateProfileEngagementRepository.recentActivity(candidateId, 12).stream()
                .map(item -> new CandidateDashboardResponse.RecruiterActivity(item.recruiterName(), item.recruiterTitle(), item.organisationName(), item.action(), item.occurredAt()))
                .toList();
        List<CandidateDashboardResponse.Application> applications = jobApplicationRepository
                .findByCandidate_Id(candidateId, PageRequest.of(0, 12, Sort.by(Sort.Direction.DESC, "updatedAt"))).getContent().stream()
                .map(application -> new CandidateDashboardResponse.Application(application.getId().toString(), application.getJob().getTitle(), application.getJob().getOrganisation().getName(), application.getPipelineStage(), application.getUpdatedAt()))
                .toList();
        return new CandidateDashboardResponse(
                new CandidateDashboardResponse.Profile(candidate.getFullName(), candidate.getHeadline(), candidate.getDomainCategory().name(), candidate.isProfileSearchable(), candidate.getUpdatedAt(), candidate.getLastActiveAt()),
                new CandidateDashboardResponse.Performance(rangeDays, engagement.totalViews(), totalActions, engagement.totalViews(), engagement.totalDownloads(),
                        engagement.currentViews(), currentActions, percentageChange(engagement.currentViews(), engagement.previousViews()), percentageChange(currentActions, previousActions),
                        profileCompleteness(candidate), activityLevel(engagement.currentViews(), engagement.currentDownloads())),
                activity, applications
        );
    }

    @Transactional
    @AuditAction(action = "CANDIDATE_DATA_ERASED", resourceType = "CANDIDATE", resourceIdArgumentIndex = 0, candidateIdArgumentIndex = 0)
    public void erase(UUID candidateId) {
        Candidate candidate = candidate(candidateId);
        candidateParseResultRepository.findByCandidate_Id(candidateId).forEach(result -> {
            try { cvDocumentStorage.delete(result.getSourceFileKey()); } catch (java.io.IOException exception) { throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "The private CV could not be removed safely."); }
        });
        candidateParseResultRepository.deleteByCandidate_Id(candidateId);
        directMessageRepository.deleteBySenderIdOrRecipientId(candidateId, candidateId);
        candidateRepository.delete(candidate);
    }

    private Candidate candidate(UUID id) {
        return candidateRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate profile was not found."));
    }
    private void recordPrivacyCase(Candidate candidate, PrivacyCaseType type, Instant requestedAt) {
        PlatformPrivacyCase caseFile = platformPrivacyCaseRepository.findByCandidate_IdAndRequestType(candidate.getId(), type)
                .orElseGet(() -> PlatformPrivacyCase.builder().candidate(candidate).requestType(type).requestedAt(requestedAt).build());
        caseFile.setRequestedAt(requestedAt);
        caseFile.setStatus(PrivacyCaseStatus.REQUESTED);
        caseFile.setReviewedAt(null);
        caseFile.setReviewedByAdminId(null);
        caseFile.setReviewNote(null);
        platformPrivacyCaseRepository.save(caseFile);
    }
    private CandidateProfileResponse response(Candidate candidate) {
        return new CandidateProfileResponse(candidate.getId(), candidate.getFullName(), maskEmail(candidate.getEmail()), maskMobile(candidate.getMobile()),
                candidate.getHeadline(), candidate.getCurrentCompany(), candidate.getDepartmentRole(), candidate.getIndustry(), candidate.getPreviousRole(), candidate.getPreviousCompany(), candidate.getLocation(), candidate.getPreferredLocations(),
                candidate.getOverallExperienceYears(), candidate.getExpectedSalaryLakhs(), candidate.getNoticePeriodDays(), candidate.getGender(), candidate.getProfileSummary(), candidate.isProfileSearchable(),
                candidate.isAutomationConsent(), candidate.isSensitiveDataConsent(), candidate.isEmailVerified(), candidate.isMobileVerified(), !candidate.getParseResults().isEmpty(), candidate.getDomainCategory(), candidate.getCareerStage(), candidate.getInterestedDomains(), candidate.getWorkLinks(),
                candidate.getSkills().stream().sorted(Comparator.comparing(CandidateSkill::getSkill)).map(skill -> new CandidateProfileResponse.CandidateSkillView(skill.getSkill(), skill.getRating(), skill.getYearsOfExperience(), skill.getExperienceMonths(), skill.getSoftwareVersion(), skill.getLastUsedYear())).toList(),
                candidate.getEducation().stream().map(education -> new CandidateProfileResponse.CandidateEducationView(education.getLevel(), education.getDegreeName(), education.getInstitutionName(), education.getGraduationYear(), education.getCourseStartYear(), education.getSpecialization(), education.getStudyType(), education.getGrade())).toList(),
                candidate.getProfileDetails(),
                candidate.getUpdatedAt(), candidate.getLastActiveAt());
    }
    private List<String> normalizedValues(List<String> values) {
        return values == null ? List.of() : values.stream().filter(value -> value != null && !value.isBlank()).map(String::trim).distinct().toList();
    }
    private List<String> normalizedInterestedDomains(List<String> values) {
        List<String> normalized = normalizedValues(values);
        if (!SUPPORTED_INTERESTED_DOMAINS.containsAll(normalized)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose interested domains from the supported list.");
        }
        return normalized;
    }
    private String normalizedGender(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim().toLowerCase(java.util.Locale.ROOT);
        if (!java.util.Set.of("female", "male", "transgender", "non-binary", "prefer-not-to-say").contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a supported gender option or leave it blank.");
        }
        return normalized;
    }
    private String normalizedStudyType(String value) {
        if (value == null || value.isBlank()) return "FULL_TIME";
        String normalized = value.trim().toUpperCase(java.util.Locale.ROOT).replaceAll("\\s+", "_");
        if (!java.util.Set.of("FULL_TIME", "PART_TIME", "CORRESPONDENCE").contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a supported education type.");
        }
        return normalized;
    }
    private void ensureSearchReady(Candidate candidate) {
        if (candidate.getHeadline() == null || candidate.getLocation() == null || candidate.getSkills().isEmpty() || candidate.getEducation().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Add a current designation, location, at least one skill and education before making your profile searchable.");
        }
    }
    private CandidateApplicationResponse applicationResponse(JobApplication application) {
        Job job = application.getJob();
        Recruiter recruiter = application.getRecipientRecruiter();
        return new CandidateApplicationResponse(
                application.getId(),
                job.getPublicJobId(),
                job.getTitle(),
                job.getOrganisation().getName(),
                job.getLocation(),
                recruiter == null ? null : recruiter.getFullName(),
                recruiter == null ? null : recruiter.getDesignation(),
                application.getPipelineStage(),
                application.getAppliedAt(),
                application.getUpdatedAt()
        );
    }
    private ApplicationAttribution applicationAttribution(Candidate applicant, Job job, String rawReferralCode, String rawSource) {
        String code = trimToNull(rawReferralCode);
        JobReferral referral = code == null ? null : jobReferralRepository.findByReferralCode(code.toUpperCase(java.util.Locale.ROOT))
                .filter(value -> value.getJob().getInternalId().equals(job.getInternalId()))
                .filter(value -> value.getReferrerCandidate() == null || !value.getReferrerCandidate().getId().equals(applicant.getId()))
                .orElse(null);
        return new ApplicationAttribution(referral, referral == null ? sharedSource(rawSource) : ApplicationSource.CANDIDATE_SHARE);
    }
    private ApplicationSource sharedSource(String rawSource) {
        String source = rawSource == null ? "" : rawSource.trim().toUpperCase(java.util.Locale.ROOT).replace('-', '_');
        return switch (source) {
            case "LINKEDIN" -> ApplicationSource.LINKEDIN;
            case "X", "TWITTER" -> ApplicationSource.X;
            case "WHATSAPP" -> ApplicationSource.WHATSAPP;
            case "COPY", "COPY_LINK" -> ApplicationSource.COPY_LINK;
            case "CANDIDATE_SHARE", "SHARED_LINK", "SOCIAL" -> ApplicationSource.SHARED_LINK;
            default -> ApplicationSource.DIRECT;
        };
    }
    private void preserveLegacyReferralAttribution(JobReferral referral, Candidate applicant) {
        if (referral == null || referral.getApplicantCandidate() != null) return;
        referral.setApplicantCandidate(applicant);
        referral.setAppliedAt(Instant.now());
    }
    private record ApplicationAttribution(JobReferral referral, ApplicationSource source) { }
    private WorkflowResponses.CandidatePrivacy privacyResponse(Candidate candidate, CandidateContactPreference preference) {
        return new WorkflowResponses.CandidatePrivacy(candidate.isProfileSearchable(), candidate.isAutomationConsent(), preference != null && preference.isOutreachOptOut(), candidate.isSensitiveDataConsent(),
                preference == null ? null : preference.getDataExportRequestedAt(), preference == null ? null : preference.getDeletionRequestedAt(),
                preference == null ? candidate.getUpdatedAt() : preference.getUpdatedAt());
    }
    private boolean hasSensitiveProfileData(CandidateProfileDetailsRequest details) {
        if (details == null) return false;
        CandidateProfileDetailsRequest.PersonalDetailsRequest personal = details.personalDetails();
        CandidateProfileDetailsRequest.InclusionDetailsRequest inclusion = details.inclusionDetails();
        if (personal != null && (hasText(personal.maritalStatus()) || personal.birthDay() != null || personal.birthMonth() != null
                || personal.birthYear() != null || hasText(personal.category()) || hasText(personal.usaWorkPermit())
                || personal.otherCountryWorkPermits() != null && !personal.otherCountryWorkPermits().isEmpty()
                || hasText(personal.permanentAddress()) || hasText(personal.hometown()) || hasText(personal.pincode()))) return true;
        return inclusion != null && (hasText(inclusion.disabilityStatus()) || hasText(inclusion.disabilityDetails())
                || Boolean.TRUE.equals(inclusion.militaryExperience()) || hasText(inclusion.militaryDetails())
                || Boolean.TRUE.equals(inclusion.careerBreak()) || hasText(inclusion.careerBreakDetails())
                || inclusion.diversityTags() != null && !inclusion.diversityTags().isEmpty());
    }
    private JsonNode scrubSensitiveProfileData(JsonNode current) {
        if (current == null || !current.isObject()) return current;
        com.fasterxml.jackson.databind.node.ObjectNode copy = current.deepCopy();
        copy.remove("personalDetails");
        copy.remove("inclusionDetails");
        return copy;
    }
    private boolean hasText(String value) { return value != null && !value.isBlank(); }
    private String value(String value) { return value == null ? "" : value; }
    private String value(Object value) { return value == null ? "" : String.valueOf(value); }
    private String nextStep(PipelineStage stage) {
        return switch (stage) {
            case APPLIED -> "The hiring team will review your application.";
            case SCREENING -> "Your profile is being reviewed by the hiring team.";
            case INTERVIEWING -> "Check your scheduled interviews and prepare any requested materials.";
            case FINAL_STAGE -> "The team is completing the final review.";
            case OFFER -> "Review your offer and respond through your recruiter conversation.";
            case ONBOARDED -> "Your hiring journey for this role is complete.";
            case REJECTED -> "This role is closed. Continue exploring other opportunities.";
        };
    }
    private int profileCompleteness(Candidate candidate) {
        JsonNode details = candidate.getProfileDetails();
        boolean hasResumeHeadline = details != null && !details.path("resumeHeadline").asText("").isBlank();
        boolean hasEmployment = false;
        if (details != null && details.path("employment").isArray()) {
            for (JsonNode employment : details.path("employment")) {
                if (!employment.path("companyName").asText("").isBlank() && !employment.path("jobTitle").asText("").isBlank()) {
                    hasEmployment = true;
                    break;
                }
            }
        }
        int completed = 0;
        if (candidate.getHeadline() != null) completed++;
        if (candidate.getLocation() != null) completed++;
        if (candidate.getOverallExperienceYears() != null) completed++;
        if (candidate.getProfileSummary() != null) completed++;
        if (!candidate.getSkills().isEmpty()) completed++;
        if (!candidate.getEducation().isEmpty()) completed++;
        if (hasResumeHeadline) completed++;
        if (hasEmployment) completed++;
        if (!candidate.getWorkLinks().isEmpty()) completed++;
        if (!candidate.getInterestedDomains().isEmpty()) completed++;
        return Math.round((completed * 100f) / 10f);
    }
    private int percentageChange(long current, long previous) {
        if (previous == 0) return current > 0 ? 100 : 0;
        return (int) Math.round(((current - previous) * 100d) / previous);
    }
    private String activityLevel(long views, long downloads) {
        long score = views + (downloads * 2);
        if (score >= 8) return "HIGH";
        if (score >= 3) return "MEDIUM";
        return "BUILDING";
    }
    private String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String maskEmail(String email) { int at = email.indexOf('@'); return at < 1 ? "••••" : email.substring(0, 1) + "••••@" + email.substring(at + 1); }
    private String maskMobile(String mobile) { return mobile == null || mobile.length() < 4 ? "••••" : "+••••••" + mobile.substring(mobile.length() - 3); }
}

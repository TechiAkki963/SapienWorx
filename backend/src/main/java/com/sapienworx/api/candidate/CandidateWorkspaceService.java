package com.sapienworx.api.candidate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.communication.DirectMessageRepository;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.CandidateEngagementMetrics;
import com.sapienworx.api.recruiter.CandidateProfileEngagementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
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
    public CandidateApplicationResponse apply(UUID candidateId, String publicJobId, CandidateApplicationRequest request) {
        Candidate candidate = candidate(candidateId);
        Job job = jobRepository.findByPublicJobId(publicJobId).filter(value -> value.getStatus() == JobStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published job was not found."));
        if (jobApplicationRepository.existsByCandidate_IdAndJob_InternalId(candidateId, job.getInternalId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already applied for this job.");
        }
        Recruiter recipient = job.getCreatedByRecruiter();
        if (recipient == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This job is not assigned to a hiring recruiter yet.");
        }
        JobApplication application = jobApplicationRepository.save(JobApplication.builder().candidate(candidate).job(job)
                .recipientRecruiter(recipient).coverLetter(trimToNull(request.coverLetter())).pipelineStage(PipelineStage.APPLIED).build());
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
        directMessageRepository.deleteBySenderIdOrRecipientId(candidateId, candidateId);
        candidateRepository.delete(candidate);
    }

    private Candidate candidate(UUID id) {
        return candidateRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate profile was not found."));
    }
    private CandidateProfileResponse response(Candidate candidate) {
        return new CandidateProfileResponse(candidate.getId(), candidate.getFullName(), maskEmail(candidate.getEmail()), maskMobile(candidate.getMobile()),
                candidate.getHeadline(), candidate.getCurrentCompany(), candidate.getDepartmentRole(), candidate.getIndustry(), candidate.getPreviousRole(), candidate.getPreviousCompany(), candidate.getLocation(), candidate.getPreferredLocations(),
                candidate.getOverallExperienceYears(), candidate.getExpectedSalaryLakhs(), candidate.getNoticePeriodDays(), candidate.getGender(), candidate.getProfileSummary(), candidate.isProfileSearchable(),
                candidate.isAutomationConsent(), candidate.isEmailVerified(), candidate.isMobileVerified(), !candidate.getParseResults().isEmpty(), candidate.getDomainCategory(), candidate.getInterestedDomains(), candidate.getWorkLinks(),
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

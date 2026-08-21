package com.sapienworx.api.candidate;

import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.communication.DirectMessageRepository;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.recruiter.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CandidateWorkspaceService {
    private final CandidateRepository candidateRepository;
    private final JobRepository jobRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final RecruiterRepository recruiterRepository;
    private final NotificationService notificationService;
    private final DirectMessageRepository directMessageRepository;

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
        candidate.setLocation(trimToNull(request.location()));
        candidate.setOverallExperienceYears(request.overallExperienceYears());
        candidate.setExpectedSalaryLakhs(request.expectedSalaryLakhs());
        candidate.setNoticePeriodDays(request.noticePeriodDays());
        candidate.setProfileSummary(trimToNull(request.profileSummary()));
        candidate.setProfileSearchable(request.profileSearchable());
        candidate.setWorkLinks(request.workLinks() == null ? List.of() : request.workLinks().stream().filter(link -> link != null && !link.isBlank()).map(String::trim).toList());
        if (request.skills() != null) {
            candidate.getSkills().clear();
            request.skills().forEach(skill -> candidate.getSkills().add(CandidateSkill.builder().candidate(candidate)
                    .skill(skill.skill().trim()).rating(skill.rating()).yearsOfExperience(skill.yearsOfExperience()).build()));
        }
        if (request.education() != null) {
            candidate.getEducation().clear();
            request.education().forEach(education -> candidate.getEducation().add(CandidateEducation.builder().candidate(candidate)
                    .level(education.level()).degreeName(education.degreeName().trim()).institutionName(education.institutionName().trim())
                    .graduationYear(education.graduationYear()).grade(trimToNull(education.grade())).build()));
        }
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
        JobApplication application = jobApplicationRepository.save(JobApplication.builder().candidate(candidate).job(job)
                .coverLetter(trimToNull(request.coverLetter())).pipelineStage(PipelineStage.APPLIED).build());
        recruiterRepository.findByOrganisation_Id(job.getOrganisation().getId()).forEach(recruiter ->
                notificationService.create(recruiter.getId(), "NEW_APPLICATION", "New application for " + job.getTitle(),
                        candidate.getFullName() + " has applied.", "APPLICATION", application.getId())
        );
        return applicationResponse(application);
    }

    @Transactional(readOnly = true)
    public Page<CandidateApplicationResponse> applications(UUID candidateId, Pageable pageable) {
        return jobApplicationRepository.findByCandidate_Id(candidateId, pageable).map(this::applicationResponse);
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
                candidate.getHeadline(), candidate.getLocation(), candidate.getOverallExperienceYears(), candidate.getExpectedSalaryLakhs(), candidate.getNoticePeriodDays(),
                candidate.getProfileSummary(), candidate.isProfileSearchable(), candidate.isAutomationConsent(), candidate.getDomainCategory(), candidate.getWorkLinks(),
                candidate.getSkills().stream().sorted(Comparator.comparing(CandidateSkill::getSkill)).map(skill -> new CandidateProfileResponse.CandidateSkillView(skill.getSkill(), skill.getRating(), skill.getYearsOfExperience())).toList(),
                candidate.getEducation().stream().map(education -> new CandidateProfileResponse.CandidateEducationView(education.getLevel(), education.getDegreeName(), education.getInstitutionName(), education.getGraduationYear(), education.getGrade())).toList(),
                candidate.getUpdatedAt(), candidate.getLastActiveAt());
    }
    private CandidateApplicationResponse applicationResponse(JobApplication application) {
        return new CandidateApplicationResponse(application.getId(), application.getJob().getPublicJobId(), application.getJob().getTitle(), application.getJob().getOrganisation().getName(), application.getPipelineStage(), application.getAppliedAt(), application.getUpdatedAt());
    }
    private String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String maskEmail(String email) { int at = email.indexOf('@'); return at < 1 ? "••••" : email.substring(0, 1) + "••••@" + email.substring(at + 1); }
    private String maskMobile(String mobile) { return mobile == null || mobile.length() < 4 ? "••••" : "+••••••" + mobile.substring(mobile.length() - 3); }
}

package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.RecruiterNoteRepository;
import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateCareerStage;
import com.sapienworx.api.candidate.CandidateEducation;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecruiterPipelineV2Service {
    private final RecruiterRepository recruiterRepository;
    private final RecruiterPipelineV2Repository pipelineRepository;
    private final RecruiterNoteRepository recruiterNoteRepository;
    private final HiringLifecycleService hiringLifecycleService;

    @Transactional(readOnly = true)
    public Page<PipelineCandidateResponse> search(
            UUID recruiterId,
            PipelineStage stage,
            String query,
            Integer minimumExperienceYears,
            Integer maximumExperienceYears,
            String skill,
            String company,
            String education,
            String location,
            Integer minimumSalaryLakhs,
            Integer maximumSalaryLakhs,
            Integer maximumNoticePeriodDays,
            Integer activeWithinDays,
            CandidateCareerStage careerStage,
            String gender,
            String jobRole,
            String sortBy,
            String sortDirection,
            Pageable pageable
    ) {
        requireRecruiter(recruiterId);
        validateRange(minimumExperienceYears, maximumExperienceYears, "experience");
        validateRange(minimumSalaryLakhs, maximumSalaryLakhs, "salary");
        Instant activeAfter = activeWithinDays == null || activeWithinDays <= 0
                ? null : Instant.now().minus(Math.min(activeWithinDays, 3650), ChronoUnit.DAYS);
        return pipelineRepository.search(recruiterId, stage, query, minimumExperienceYears, maximumExperienceYears,
                        skill, company, education, location, minimumSalaryLakhs, maximumSalaryLakhs,
                        maximumNoticePeriodDays, activeAfter, careerStage, null, jobRole, sortBy, sortDirection, pageable)
                .map(application -> response(recruiterId, application));
    }

    @Transactional
    public List<PipelineCandidateResponse> bulkMove(UUID recruiterId, BulkPipelineStageRequest request) {
        requireRecruiter(recruiterId);
        return request.applicationIds().stream().distinct().limit(100)
                .map(applicationId -> hiringLifecycleService.moveStage(recruiterId, applicationId, request.stage()))
                .toList();
    }

    private PipelineCandidateResponse response(UUID recruiterId, JobApplication application) {
        Candidate candidate = application.getCandidate();
        String educationSummary = candidate.getEducation().stream()
                .max(Comparator.comparing(CandidateEducation::getGraduationYear, Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(value -> value.getDegreeName() + " · " + value.getInstitutionName())
                .orElse(null);
        return new PipelineCandidateResponse(
                application.getId(), candidate.getId(), candidate.getFullName(), candidate.getHeadline(), candidate.getCurrentCompany(),
                candidate.getLocation(), candidate.getPreferredLocations(), candidate.getOverallExperienceYears(), candidate.getExpectedSalaryLakhs(),
                candidate.getNoticePeriodDays(), candidate.getDepartmentRole(), educationSummary, candidate.getCareerStage(),
                application.getJob().getPublicJobId(), application.getJob().getTitle(),
                candidate.getSkills().stream().map(skill -> skill.getSkill()).sorted().toList(),
                maskEmail(candidate.getEmail()), maskMobile(candidate.getMobile()), application.getPipelineStage(),
                recruiterNoteRepository.findTop10ByApplication_IdOrderByUpdatedAtDesc(application.getId()).stream().map(note -> note.getNoteText()).toList(),
                candidate.getUpdatedAt(), candidate.getLastActiveAt(), pipelineRepository.lastViewedAt(recruiterId, candidate.getId()),
                application.getApplicationSource().name(), application.getReferral() == null ? null : application.getReferral().getReferralCode());
    }

    private void requireRecruiter(UUID recruiterId) {
        if (!recruiterRepository.existsById(recruiterId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter profile was not found.");
        }
    }

    private void validateRange(Integer minimum, Integer maximum, String label) {
        if (minimum != null && maximum != null && minimum > maximum) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Minimum " + label + " cannot exceed maximum " + label + ".");
        }
    }

    private String maskEmail(String value) {
        if (value == null) return "••••";
        int at = value.indexOf('@');
        return at < 1 ? "••••" : value.substring(0, 1) + "••••@" + value.substring(at + 1);
    }

    private String maskMobile(String value) {
        return value == null || value.length() < 4 ? "••••" : "+••••••" + value.substring(value.length() - 3);
    }
}

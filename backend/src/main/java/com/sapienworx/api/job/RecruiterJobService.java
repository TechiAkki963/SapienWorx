package com.sapienworx.api.job;

import com.sapienworx.api.application.JobApplicationMetricsProjection;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.taxonomy.DomainCategory;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import com.sapienworx.api.admin.OrganisationBillingPolicy;
import com.sapienworx.api.audit.AuditAction;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecruiterJobService {
    private final JobService jobService;
    private final JobRepository jobRepository;
    private final RecruiterRepository recruiterRepository;
    private final JobApplicationRepository applicationRepository;
    private final JobDescriptionSanitizer descriptionSanitizer;
    private final PlatformAccessPolicy platformAccessPolicy;
    private final OrganisationBillingPolicy organisationBillingPolicy;

    @Transactional
    @AuditAction(action = "RECRUITER_JOB_DRAFT_CREATED", resourceType = "JOB")
    public JobResponse createDraft(UUID recruiterId, JobUpsertRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        platformAccessPolicy.requireJobCreationAllowed(recruiter.getOrganisation().getId());
        organisationBillingPolicy.requireJobCredit(recruiter.getOrganisation().getId());
        Job job = apply(Job.builder().status(JobStatus.DRAFT).build(), request);
        return JobResponse.fromForRecruiter(jobService.create(job, recruiter));
    }

    @Transactional
    @AuditAction(action = "RECRUITER_JOB_UPDATED", resourceType = "JOB", jobIdArgumentIndex = 1)
    public JobResponse update(UUID recruiterId, String publicJobId, JobUpsertRequest request) {
        Job job = jobForRecruiter(recruiterId, publicJobId);
        Job updated = apply(job, request);
        if (updated.getStatus() == JobStatus.ACTIVE) validateForPublishing(updated);
        return JobResponse.fromForRecruiter(updated);
    }

    @Transactional
    @AuditAction(action = "RECRUITER_JOB_PUBLISHED", resourceType = "JOB", jobIdArgumentIndex = 1)
    public JobResponse publish(UUID recruiterId, String publicJobId) {
        Job job = jobForRecruiter(recruiterId, publicJobId);
        if (job.getStatus() == JobStatus.ARCHIVED || job.getStatus() == JobStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Closed or archived jobs cannot be published.");
        }
        validateForPublishing(job);
        job.setStatus(JobStatus.ACTIVE);
        if (job.getPublishedAt() == null) job.setPublishedAt(Instant.now());
        return JobResponse.fromForRecruiter(job);
    }

    @Transactional
    @AuditAction(action = "RECRUITER_JOB_DUPLICATED", resourceType = "JOB", jobIdArgumentIndex = 1)
    public JobResponse duplicate(UUID recruiterId, String publicJobId) {
        Job source = jobForRecruiter(recruiterId, publicJobId);
        platformAccessPolicy.requireJobCreationAllowed(source.getOrganisation().getId());
        organisationBillingPolicy.requireJobCredit(source.getOrganisation().getId());
        Job copy = Job.builder()
                .title(source.getTitle() + " (copy)")
                .department(source.getDepartment())
                .employmentType(source.getEmploymentType())
                .workplaceModel(source.getWorkplaceModel())
                .location(source.getLocation())
                .minimumExperienceYears(source.getMinimumExperienceYears())
                .maximumExperienceYears(source.getMaximumExperienceYears())
                .minimumSalaryLakhs(source.getMinimumSalaryLakhs())
                .maximumSalaryLakhs(source.getMaximumSalaryLakhs())
                .salaryVisible(source.isSalaryVisible())
                .descriptionHtml(source.getDescriptionHtml())
                .companyOverview(source.getCompanyOverview())
                .whyJoin(source.getWhyJoin())
                .responsibilitiesHtml(source.getResponsibilitiesHtml())
                .hiringProcess(source.getHiringProcess())
                .skills(new LinkedHashSet<>(source.getSkills()))
                .domainCategory(source.getDomainCategory())
                .status(JobStatus.DRAFT)
                .build();
        return JobResponse.fromForRecruiter(jobService.create(copy, recruiter(recruiterId)));
    }

    @Transactional
    @AuditAction(action = "RECRUITER_JOB_STATUS_CHANGED", resourceType = "JOB", jobIdArgumentIndex = 1)
    public JobResponse changeStatus(UUID recruiterId, String publicJobId, JobStatus status) {
        Job job = jobForRecruiter(recruiterId, publicJobId);
        JobStatus current = job.getStatus();
        if (current == status) return JobResponse.fromForRecruiter(job);
        boolean allowed = (current == JobStatus.DRAFT && status == JobStatus.ARCHIVED)
                || (current == JobStatus.ACTIVE && (status == JobStatus.CLOSED || status == JobStatus.ARCHIVED))
                || (current == JobStatus.CLOSED && (status == JobStatus.ACTIVE || status == JobStatus.ARCHIVED))
                || (current == JobStatus.ARCHIVED && status == JobStatus.DRAFT);
        if (!allowed) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "This job cannot move from " + current.name().toLowerCase(Locale.ROOT) + " to " + status.name().toLowerCase(Locale.ROOT) + ".");
        if (status == JobStatus.ACTIVE) validateForPublishing(job);
        job.setStatus(status);
        if (status == JobStatus.CLOSED || status == JobStatus.ARCHIVED) job.setClosedAt(Instant.now());
        if (status == JobStatus.ACTIVE) job.setClosedAt(null);
        if (status == JobStatus.DRAFT) {
            job.setClosedAt(null);
            job.setPublishedAt(null);
        }
        return JobResponse.fromForRecruiter(job);
    }

    @Transactional(readOnly = true)
    public Page<RecruiterManagedJobResponse> list(UUID recruiterId, JobStatus status, Pageable pageable) {
        UUID organisationId = recruiter(recruiterId).getOrganisation().getId();
        Page<Job> jobs = status == null
                ? jobRepository.findByOrganisation_IdOrderByUpdatedAtDesc(organisationId, pageable)
                : jobRepository.findByOrganisation_IdAndStatusOrderByUpdatedAtDesc(organisationId, status, pageable);
        if (jobs.isEmpty()) return jobs.map(job -> RecruiterManagedJobResponse.from(job, null));
        Map<UUID, JobApplicationMetricsProjection> metrics = applicationRepository
                .summarizeByJobIds(jobs.getContent().stream().map(Job::getInternalId).toList()).stream()
                .collect(java.util.stream.Collectors.toMap(JobApplicationMetricsProjection::getJobInternalId, value -> value));
        return jobs.map(job -> RecruiterManagedJobResponse.from(job, metrics.get(job.getInternalId())));
    }

    @Transactional(readOnly = true)
    public JobResponse details(UUID recruiterId, String publicJobId) {
        return JobResponse.fromForRecruiter(jobForRecruiter(recruiterId, publicJobId));
    }

    @Transactional(readOnly = true)
    public RecruiterJobWorkspaceResponse workspace(UUID recruiterId, String publicJobId,
                                                    org.springframework.data.domain.Pageable pageable) {
        Job job = jobForRecruiter(recruiterId, publicJobId);
        JobApplicationMetricsProjection metrics = applicationRepository.summarizeByJobIds(List.of(job.getInternalId()))
                .stream().findFirst().orElse(null);
        var applications = applicationRepository.findByJob_InternalIdAndRecipientRecruiter_IdOrderByUpdatedAtDesc(job.getInternalId(), recruiterId, pageable)
                .map(RecruiterJobApplicantResponse::from);
        return new RecruiterJobWorkspaceResponse(RecruiterManagedJobResponse.from(job, metrics),
                com.sapienworx.api.web.ApiPageResponse.from(applications));
    }

    @Transactional(readOnly = true)
    @AuditAction(action = "RECRUITER_JOB_SHARE_OPENED", resourceType = "JOB", jobIdArgumentIndex = 1)
    public JobShareResponse share(UUID recruiterId, String publicJobId) {
        Job job = jobForRecruiter(recruiterId, publicJobId);
        if (job.getStatus() != JobStatus.ACTIVE) throw new ResponseStatusException(HttpStatus.CONFLICT, "Publish the job before sharing it.");
        String experience = job.getMinimumExperienceYears() + "–" + job.getMaximumExperienceYears() + " years";
        String skills = String.join(", ", job.getSkills().stream().limit(3).toList());
        return new JobShareResponse(JobResponse.from(job).publicPath(), job.getTitle() + " · " + job.getOrganisation().getName(),
                experience + " · " + job.getLocation() + (skills.isBlank() ? "" : " · " + skills));
    }

    private Job apply(Job job, JobUpsertRequest request) {
        job.setTitle(request.title() == null || request.title().isBlank() ? "Untitled role" : request.title().trim());
        job.setDepartment(request.department() == null || request.department().isBlank() ? "General" : request.department().trim());
        job.setEmploymentType(request.employmentType() == null ? EmploymentType.FULL_TIME : request.employmentType());
        job.setWorkplaceModel(request.workplaceModel() == null ? WorkplaceModel.ON_SITE : request.workplaceModel());
        job.setLocation(request.location() == null ? "" : request.location().trim());
        job.setMinimumExperienceYears(request.minimumExperienceYears() == null ? 0 : request.minimumExperienceYears());
        job.setMaximumExperienceYears(request.maximumExperienceYears() == null ? job.getMinimumExperienceYears() : request.maximumExperienceYears());
        job.setMinimumSalaryLakhs(request.minimumSalaryLakhs());
        job.setMaximumSalaryLakhs(request.maximumSalaryLakhs());
        job.setSalaryVisible(request.salaryVisible());
        job.setDescriptionHtml(descriptionSanitizer.sanitize(request.descriptionHtml() == null ? "" : request.descriptionHtml()));
        job.setCompanyOverview(normalizeCopy(request.companyOverview(), 5_000));
        job.setWhyJoin(normalizeCopy(request.whyJoin(), 5_000));
        job.setResponsibilitiesHtml(request.responsibilitiesHtml() == null || request.responsibilitiesHtml().isBlank()
                ? "" : descriptionSanitizer.sanitize(request.responsibilitiesHtml()));
        job.setHiringProcess(normalizeHiringProcess(request.hiringProcess()));
        job.setSkills(normalizeSkills(request.skills()));
        job.setDomainCategory(request.domainCategory() == null ? DomainCategory.UNASSIGNED : request.domainCategory());
        return job;
    }

    private void validateForPublishing(Job job) {
        if ("Untitled role".equals(job.getTitle()) || job.getTitle().isBlank()) invalid("Add a job title before publishing.");
        if (job.getLocation().isBlank()) invalid("Add a job location before publishing.");
        if (job.getDescriptionHtml().isBlank()) invalid("Add a role summary before publishing.");
        if (job.getResponsibilitiesHtml().isBlank()) invalid("Add the role responsibilities before publishing.");
        if (job.getCompanyOverview().isBlank()) invalid("Add the company overview before publishing.");
        if (job.getWhyJoin().isBlank()) invalid("Explain why a candidate should join before publishing.");
        if (job.getHiringProcess().lines().filter(step -> !step.isBlank()).count() < 3) invalid("Add at least three hiring stages before publishing.");
        if (job.getSkills().isEmpty()) invalid("Add at least one skill before publishing.");
    }

    private void invalid(String reason) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }

    private Set<String> normalizeSkills(Set<String> skills) {
        if (skills == null) return new LinkedHashSet<>();
        Set<String> result = new LinkedHashSet<>();
        skills.stream().filter(skill -> skill != null && !skill.isBlank()).map(String::trim)
                .map(skill -> skill.substring(0, Math.min(skill.length(), 80)))
                .forEach(skill -> result.add(skill));
        return result;
    }

    private String normalizeCopy(String value, int maximumLength) {
        if (value == null) return "";
        String normalized = value.trim().replaceAll("\\s+", " ");
        return normalized.substring(0, Math.min(normalized.length(), maximumLength));
    }

    private String normalizeHiringProcess(String value) {
        if (value == null) return "";
        return value.lines().map(String::trim).filter(step -> !step.isBlank()).limit(6)
                .map(step -> step.substring(0, Math.min(step.length(), 160)))
                .collect(java.util.stream.Collectors.joining("\n"));
    }

    private Recruiter recruiter(UUID recruiterId) {
        return recruiterRepository.findById(recruiterId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter profile was not found."));
    }
    private Job jobForRecruiter(UUID recruiterId, String publicJobId) {
        Recruiter recruiter = recruiter(recruiterId);
        return jobRepository.findByPublicJobId(publicJobId).filter(job -> job.getOrganisation().getId().equals(recruiter.getOrganisation().getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job was not found in your organisation."));
    }
}

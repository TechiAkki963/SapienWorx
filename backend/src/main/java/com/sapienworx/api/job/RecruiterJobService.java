package com.sapienworx.api.job;

import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.taxonomy.DomainCategory;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import com.sapienworx.api.admin.OrganisationBillingPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecruiterJobService {
    private final JobService jobService;
    private final JobRepository jobRepository;
    private final RecruiterRepository recruiterRepository;
    private final JobDescriptionSanitizer descriptionSanitizer;
    private final PlatformAccessPolicy platformAccessPolicy;
    private final OrganisationBillingPolicy organisationBillingPolicy;

    @Transactional
    public JobResponse createDraft(UUID recruiterId, JobUpsertRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        platformAccessPolicy.requireJobCreationAllowed(recruiter.getOrganisation().getId());
        organisationBillingPolicy.requireJobCredit(recruiter.getOrganisation().getId());
        Job job = apply(Job.builder().status(JobStatus.DRAFT).build(), request);
        return JobResponse.from(jobService.create(job, recruiter));
    }

    @Transactional
    public JobResponse update(UUID recruiterId, String publicJobId, JobUpsertRequest request) {
        Job job = jobForRecruiter(recruiterId, publicJobId);
        return JobResponse.from(apply(job, request));
    }

    @Transactional
    public JobResponse publish(UUID recruiterId, String publicJobId) {
        Job job = jobForRecruiter(recruiterId, publicJobId);
        if (job.getStatus() == JobStatus.ARCHIVED || job.getStatus() == JobStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Closed or archived jobs cannot be published.");
        }
        job.setStatus(JobStatus.ACTIVE);
        if (job.getPublishedAt() == null) job.setPublishedAt(Instant.now());
        return JobResponse.from(job);
    }

    @Transactional
    public JobResponse duplicate(UUID recruiterId, String publicJobId) {
        Job source = jobForRecruiter(recruiterId, publicJobId);
        platformAccessPolicy.requireJobCreationAllowed(source.getOrganisation().getId());
        organisationBillingPolicy.requireJobCredit(source.getOrganisation().getId());
        Job copy = Job.builder()
                .title(source.getTitle() + " (copy)")
                .department(source.getDepartment())
                .location(source.getLocation())
                .minimumExperienceYears(source.getMinimumExperienceYears())
                .maximumExperienceYears(source.getMaximumExperienceYears())
                .minimumSalaryLakhs(source.getMinimumSalaryLakhs())
                .maximumSalaryLakhs(source.getMaximumSalaryLakhs())
                .salaryVisible(source.isSalaryVisible())
                .descriptionHtml(source.getDescriptionHtml())
                .skills(new LinkedHashSet<>(source.getSkills()))
                .domainCategory(source.getDomainCategory())
                .status(JobStatus.DRAFT)
                .build();
        return JobResponse.from(jobService.create(copy, recruiter(recruiterId)));
    }

    @Transactional
    public JobResponse changeStatus(UUID recruiterId, String publicJobId, JobStatus status) {
        Job job = jobForRecruiter(recruiterId, publicJobId);
        job.setStatus(status);
        if (status == JobStatus.CLOSED || status == JobStatus.ARCHIVED) job.setClosedAt(Instant.now());
        return JobResponse.from(job);
    }

    @Transactional(readOnly = true)
    public Page<JobResponse> list(UUID recruiterId, JobStatus status, Pageable pageable) {
        UUID organisationId = recruiter(recruiterId).getOrganisation().getId();
        Page<Job> jobs = status == null
                ? jobRepository.findByOrganisation_IdOrderByUpdatedAtDesc(organisationId, pageable)
                : jobRepository.findByOrganisation_IdAndStatusOrderByUpdatedAtDesc(organisationId, status, pageable);
        return jobs.map(JobResponse::from);
    }

    @Transactional(readOnly = true)
    public JobResponse details(UUID recruiterId, String publicJobId) {
        return JobResponse.from(jobForRecruiter(recruiterId, publicJobId));
    }

    @Transactional(readOnly = true)
    public JobShareResponse share(UUID recruiterId, String publicJobId) {
        Job job = jobForRecruiter(recruiterId, publicJobId);
        if (job.getStatus() != JobStatus.ACTIVE) throw new ResponseStatusException(HttpStatus.CONFLICT, "Publish the job before sharing it.");
        String experience = job.getMinimumExperienceYears() + "–" + job.getMaximumExperienceYears() + " years";
        String skills = String.join(", ", job.getSkills().stream().limit(3).toList());
        return new JobShareResponse(JobResponse.from(job).publicPath(), job.getTitle() + " · " + job.getOrganisation().getName(),
                experience + " · " + job.getLocation() + (skills.isBlank() ? "" : " · " + skills));
    }

    private Job apply(Job job, JobUpsertRequest request) {
        job.setTitle(request.title().trim());
        job.setDepartment(request.department() == null || request.department().isBlank() ? "General" : request.department().trim());
        job.setLocation(request.location().trim());
        job.setMinimumExperienceYears(request.minimumExperienceYears());
        job.setMaximumExperienceYears(request.maximumExperienceYears());
        job.setMinimumSalaryLakhs(request.minimumSalaryLakhs());
        job.setMaximumSalaryLakhs(request.maximumSalaryLakhs());
        job.setSalaryVisible(request.salaryVisible());
        job.setDescriptionHtml(descriptionSanitizer.sanitize(request.descriptionHtml()));
        job.setSkills(normalizeSkills(request.skills()));
        job.setDomainCategory(request.domainCategory() == null ? DomainCategory.UNASSIGNED : request.domainCategory());
        return job;
    }

    private Set<String> normalizeSkills(Set<String> skills) {
        if (skills == null) return new LinkedHashSet<>();
        Set<String> result = new LinkedHashSet<>();
        skills.stream().filter(skill -> skill != null && !skill.isBlank()).map(String::trim)
                .map(skill -> skill.substring(0, Math.min(skill.length(), 80)))
                .forEach(skill -> result.add(skill));
        return result;
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

package com.sapienworx.api.job;

import com.sapienworx.api.taxonomy.DomainCategory;

import java.time.Instant;
import java.util.Set;

public record JobResponse(
        String jobId,
        String title,
        String organisationName,
        boolean verifiedEmployer,
        String location,
        String department,
        EmploymentType employmentType,
        WorkplaceModel workplaceModel,
        int minimumExperienceYears,
        int maximumExperienceYears,
        Integer minimumSalaryLakhs,
        Integer maximumSalaryLakhs,
        boolean salaryVisible,
        String descriptionHtml,
        String companyOverview,
        String whyJoin,
        String responsibilitiesHtml,
        String hiringProcess,
        Set<String> skills,
        JobStatus status,
        DomainCategory domainCategory,
        Instant createdAt,
        Instant updatedAt,
        Instant publishedAt,
        String publicPath
) {
    public static JobResponse from(Job job) {
        return from(job, false);
    }

    public static JobResponse fromForRecruiter(Job job) {
        return from(job, true);
    }

    private static JobResponse from(Job job, boolean includeInternalCompensation) {
        boolean verifiedEmployer = job.getOrganisation().getWorkEmailDomain() != null && !job.getOrganisation().getWorkEmailDomain().isBlank();
        return new JobResponse(job.getPublicJobId(), job.getTitle(), job.getOrganisation().getName(), verifiedEmployer, job.getLocation(),
                job.getDepartment(), job.getEmploymentType(), job.getWorkplaceModel(), job.getMinimumExperienceYears(), job.getMaximumExperienceYears(),
                includeInternalCompensation || job.isSalaryVisible() ? job.getMinimumSalaryLakhs() : null,
                includeInternalCompensation || job.isSalaryVisible() ? job.getMaximumSalaryLakhs() : null,
                job.isSalaryVisible(), job.getDescriptionHtml(), job.getCompanyOverview(), job.getWhyJoin(),
                job.getResponsibilitiesHtml(), job.getHiringProcess(), Set.copyOf(job.getSkills()), job.getStatus(),
                job.getDomainCategory(), job.getCreatedAt(), job.getUpdatedAt(), job.getPublishedAt(),
                "/jobs/" + job.getPublicJobId() + "/" + slug(job.getTitle()));
    }

    private static String slug(String value) {
        return value.toLowerCase(java.util.Locale.ROOT).trim().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}

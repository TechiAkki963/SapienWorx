package com.sapienworx.api.job;

import com.sapienworx.api.taxonomy.DomainCategory;

import java.time.Instant;
import java.util.Set;

public record JobResponse(
        String jobId,
        String title,
        String organisationName,
        String location,
        String department,
        int minimumExperienceYears,
        int maximumExperienceYears,
        Integer minimumSalaryLakhs,
        Integer maximumSalaryLakhs,
        boolean salaryVisible,
        String descriptionHtml,
        Set<String> skills,
        JobStatus status,
        DomainCategory domainCategory,
        Instant createdAt,
        Instant updatedAt,
        Instant publishedAt,
        String publicPath
) {
    public static JobResponse from(Job job) {
        return new JobResponse(job.getPublicJobId(), job.getTitle(), job.getOrganisation().getName(), job.getLocation(),
                job.getDepartment(), job.getMinimumExperienceYears(), job.getMaximumExperienceYears(),
                job.isSalaryVisible() ? job.getMinimumSalaryLakhs() : null,
                job.isSalaryVisible() ? job.getMaximumSalaryLakhs() : null,
                job.isSalaryVisible(), job.getDescriptionHtml(), Set.copyOf(job.getSkills()), job.getStatus(),
                job.getDomainCategory(), job.getCreatedAt(), job.getUpdatedAt(), job.getPublishedAt(),
                "/jobs/" + job.getPublicJobId() + "/" + slug(job.getTitle()));
    }

    private static String slug(String value) {
        return value.toLowerCase(java.util.Locale.ROOT).trim().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}

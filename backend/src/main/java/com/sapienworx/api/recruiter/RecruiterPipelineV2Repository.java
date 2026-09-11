package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.candidate.CandidateCareerStage;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Server-side recruiter pipeline search used by the rebuilt list workspace. */
@Repository
@RequiredArgsConstructor
public class RecruiterPipelineV2Repository {
    private final EntityManager entityManager;

    public Page<JobApplication> search(
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
            Instant activeAfter,
            CandidateCareerStage careerStage,
            String gender,
            String jobRole,
            String sortBy,
            String sortDirection,
            Pageable pageable
    ) {
        StringBuilder where = new StringBuilder("""
                where (application.recipientRecruiter.id = :recruiterId or application.assignedRecruiter.id = :recruiterId)
                """);
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("recruiterId", recruiterId);

        if (stage != null) { where.append(" and application.pipelineStage = :stage"); parameters.put("stage", stage); }
        if (hasText(query)) {
            where.append(" and (lower(candidate.fullName) like :query or lower(coalesce(candidate.headline, '')) like :query or lower(job.title) like :query)");
            parameters.put("query", like(query));
        }
        if (minimumExperienceYears != null) { where.append(" and candidate.overallExperienceYears >= :minimumExperienceYears"); parameters.put("minimumExperienceYears", minimumExperienceYears); }
        if (maximumExperienceYears != null) { where.append(" and candidate.overallExperienceYears <= :maximumExperienceYears"); parameters.put("maximumExperienceYears", maximumExperienceYears); }
        if (hasText(skill)) {
            where.append(" and exists (select candidateSkill.id from CandidateSkill candidateSkill where candidateSkill.candidate = candidate and lower(candidateSkill.skill) like :skill)");
            parameters.put("skill", like(skill));
        }
        if (hasText(company)) { where.append(" and lower(coalesce(candidate.currentCompany, '')) like :company"); parameters.put("company", like(company)); }
        if (hasText(education)) {
            where.append(" and exists (select candidateEducation.id from CandidateEducation candidateEducation where candidateEducation.candidate = candidate and (lower(candidateEducation.degreeName) like :education or lower(candidateEducation.institutionName) like :education or lower(coalesce(candidateEducation.specialization, '')) like :education))");
            parameters.put("education", like(education));
        }
        if (hasText(location)) { where.append(" and lower(coalesce(candidate.location, '')) like :location"); parameters.put("location", like(location)); }
        if (minimumSalaryLakhs != null) { where.append(" and candidate.expectedSalaryLakhs >= :minimumSalaryLakhs"); parameters.put("minimumSalaryLakhs", minimumSalaryLakhs); }
        if (maximumSalaryLakhs != null) { where.append(" and candidate.expectedSalaryLakhs <= :maximumSalaryLakhs"); parameters.put("maximumSalaryLakhs", maximumSalaryLakhs); }
        if (maximumNoticePeriodDays != null) { where.append(" and candidate.noticePeriodDays <= :maximumNoticePeriodDays"); parameters.put("maximumNoticePeriodDays", maximumNoticePeriodDays); }
        if (activeAfter != null) { where.append(" and candidate.lastActiveAt >= :activeAfter"); parameters.put("activeAfter", activeAfter); }
        if (careerStage != null) { where.append(" and candidate.careerStage = :careerStage"); parameters.put("careerStage", careerStage); }
        if (hasText(gender)) {
            where.append(" and candidate.sensitiveDataConsent = true and lower(coalesce(candidate.gender, '')) = :gender");
            parameters.put("gender", gender.trim().toLowerCase(java.util.Locale.ROOT));
        }
        if (hasText(jobRole)) {
            where.append(" and (lower(coalesce(candidate.departmentRole, '')) like :jobRole or lower(job.title) like :jobRole)");
            parameters.put("jobRole", like(jobRole));
        }

        String from = " from JobApplication application join application.candidate candidate join application.job job ";
        String orderBy = orderBy(sortBy, sortDirection);
        TypedQuery<JobApplication> contentQuery = entityManager.createQuery(
                "select application" + from + where + orderBy, JobApplication.class);
        TypedQuery<Long> countQuery = entityManager.createQuery("select count(application)" + from + where, Long.class);
        parameters.forEach((key, value) -> { contentQuery.setParameter(key, value); countQuery.setParameter(key, value); });
        contentQuery.setFirstResult((int) pageable.getOffset());
        contentQuery.setMaxResults(pageable.getPageSize());
        List<JobApplication> content = contentQuery.getResultList();
        long total = countQuery.getSingleResult();
        return new PageImpl<>(content, pageable, total);
    }

    public Instant lastViewedAt(UUID recruiterId, UUID candidateId) {
        Object value = entityManager.createNativeQuery("""
                select last_viewed_at from candidate_profile_engagements
                where recruiter_id = :recruiterId and candidate_id = :candidateId
                limit 1
                """)
                .setParameter("recruiterId", recruiterId)
                .setParameter("candidateId", candidateId)
                .getResultStream().findFirst().orElse(null);
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof OffsetDateTime offsetDateTime) return offsetDateTime.toInstant();
        return null;
    }

    private String orderBy(String sortBy, String sortDirection) {
        String expression = switch (sortBy == null ? "" : sortBy.trim().toLowerCase(java.util.Locale.ROOT)) {
            case "name" -> "candidate.fullName";
            case "experience" -> "candidate.overallExperienceYears";
            case "notice" -> "candidate.noticePeriodDays";
            case "stage" -> "application.pipelineStage";
            case "activity" -> "candidate.lastActiveAt";
            default -> "application.updatedAt";
        };
        String direction = "asc".equalsIgnoreCase(sortDirection) ? " asc" : " desc";
        return " order by " + expression + direction + ", application.updatedAt desc";
    }

    private boolean hasText(String value) { return value != null && !value.isBlank(); }
    private String like(String value) { return "%" + value.trim().toLowerCase(java.util.Locale.ROOT) + "%"; }
}

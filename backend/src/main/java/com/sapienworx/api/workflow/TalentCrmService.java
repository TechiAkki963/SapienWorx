package com.sapienworx.api.workflow;

import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Organisation-scoped talent CRM read model.
 *
 * Rediscovery deliberately uses only prior hiring history and professional
 * profile fields. Protected personal attributes are neither selected nor used
 * for filtering, ordering, or ranking.
 */
@Service
@RequiredArgsConstructor
public class TalentCrmService {
    private final RecruiterRepository recruiters;
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public WorkflowResponses.RediscoveryWorkspace rediscovery(UUID recruiterId, String query, int requestedLimit) {
        Recruiter recruiter = recruiters.findById(recruiterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter profile was not found."));
        UUID organisationId = recruiter.getOrganisation().getId();
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
        int limit = Math.max(1, Math.min(requestedLimit, 50));
        String like = "%" + normalizedQuery + "%";

        List<WorkflowResponses.RediscoveryCandidate> candidates = jdbc.query("""
                with history as (
                    select c.id candidate_id,
                           c.full_name,
                           c.headline,
                           c.location,
                           c.current_company,
                           c.overall_experience_years,
                           c.notice_period_days,
                           c.last_active_at,
                           max(a.applied_at) last_applied_at,
                           count(distinct a.id) application_count,
                           bool_or(a.pipeline_stage in ('INTERVIEWING','FINAL_STAGE','OFFER','ONBOARDED')) interviewed_before,
                           bool_or(a.pipeline_stage in ('FINAL_STAGE','OFFER','ONBOARDED')) reached_final_stage,
                           coalesce((select string_agg(skill.skill, ', ' order by skill.skill)
                                     from candidate_skills skill where skill.candidate_id = c.id), '') skills,
                           (select latest.pipeline_stage from job_applications latest
                            join jobs latest_job on latest_job.internal_id = latest.job_internal_id
                            where latest.candidate_id = c.id and latest_job.organisation_id = ?
                            order by latest.updated_at desc limit 1) latest_stage,
                           (select latest_job.title from job_applications latest
                            join jobs latest_job on latest_job.internal_id = latest.job_internal_id
                            where latest.candidate_id = c.id and latest_job.organisation_id = ?
                            order by latest.updated_at desc limit 1) latest_job_title,
                           (select count(distinct member.talent_pool_id)
                            from talent_pool_candidates member
                            join talent_pools pool on pool.id = member.talent_pool_id
                            where member.candidate_id = c.id and pool.organisation_id = ?) pool_count
                    from candidates c
                    join job_applications a on a.candidate_id = c.id
                    join jobs j on j.internal_id = a.job_internal_id
                    where j.organisation_id = ?
                      and c.profile_searchable = true
                      and (? = ''
                           or lower(c.full_name) like ?
                           or lower(coalesce(c.headline, '')) like ?
                           or lower(coalesce(c.current_company, '')) like ?
                           or exists (select 1 from candidate_skills skill
                                      where skill.candidate_id = c.id and lower(skill.skill) like ?))
                    group by c.id, c.full_name, c.headline, c.location, c.current_company,
                             c.overall_experience_years, c.notice_period_days, c.last_active_at
                )
                select * from history
                order by reached_final_stage desc, interviewed_before desc, last_applied_at desc
                limit ?
                """, (result, row) -> new WorkflowResponses.RediscoveryCandidate(
                result.getObject("candidate_id", UUID.class),
                result.getString("full_name"),
                result.getString("headline"),
                result.getString("location"),
                result.getString("current_company"),
                nullableInteger(result, "overall_experience_years"),
                nullableInteger(result, "notice_period_days"),
                splitSkills(result.getString("skills")),
                result.getString("latest_job_title"),
                result.getString("latest_stage"),
                result.getInt("application_count"),
                result.getBoolean("interviewed_before"),
                result.getBoolean("reached_final_stage"),
                result.getInt("pool_count"),
                instant(result.getTimestamp("last_applied_at")),
                instant(result.getTimestamp("last_active_at"))
        ), organisationId, organisationId, organisationId, organisationId,
                normalizedQuery, like, like, like, like, limit);

        WorkflowResponses.RediscoveryMetrics metrics = jdbc.queryForObject("""
                select count(distinct c.id) total_candidates,
                       count(distinct case when a.pipeline_stage in ('INTERVIEWING','FINAL_STAGE','OFFER','ONBOARDED') then c.id end) interviewed_candidates,
                       count(distinct case when a.pipeline_stage in ('FINAL_STAGE','OFFER','ONBOARDED') then c.id end) final_stage_candidates,
                       count(distinct case when exists (
                           select 1 from talent_pool_candidates member
                           join talent_pools pool on pool.id = member.talent_pool_id
                           where member.candidate_id = c.id and pool.organisation_id = ?
                       ) then c.id end) pooled_candidates
                from candidates c
                join job_applications a on a.candidate_id = c.id
                join jobs j on j.internal_id = a.job_internal_id
                where j.organisation_id = ? and c.profile_searchable = true
                """, (result, row) -> new WorkflowResponses.RediscoveryMetrics(
                result.getLong("total_candidates"),
                result.getLong("interviewed_candidates"),
                result.getLong("final_stage_candidates"),
                result.getLong("pooled_candidates")
        ), organisationId, organisationId);

        return new WorkflowResponses.RediscoveryWorkspace(metrics, candidates);
    }

    private Integer nullableInteger(java.sql.ResultSet result, String column) throws java.sql.SQLException {
        int value = result.getInt(column);
        return result.wasNull() ? null : value;
    }

    private Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private List<String> splitSkills(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split(",\\s*"))
                .map(String::trim)
                .filter(skill -> !skill.isBlank())
                .limit(12)
                .toList();
    }
}

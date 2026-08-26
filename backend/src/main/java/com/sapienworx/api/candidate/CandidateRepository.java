package com.sapienworx.api.candidate;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface CandidateRepository extends JpaRepository<Candidate, UUID> {
    Optional<Candidate> findByEmail(String email);
    Optional<Candidate> findByMobile(String mobile);
    boolean existsByEmailOrMobile(String email, String mobile);

    /**
     * PostgreSQL-only full-text retrieval backed by the indexed tsvector in
     * candidate_sourcing_index. All text is bound as a parameter, never
     * concatenated into SQL, before PostgreSQL compiles the tsquery.
     */
    @Query(value = """
            select c.id as candidateId,
                   c.full_name as fullName,
                   c.headline as headline,
                   c.current_company as currentCompany,
                   coalesce((select education.degree_name || ' · ' || education.institution_name
                             from candidate_educations education
                             where education.candidate_id = c.id
                             order by education.graduation_year desc nulls last
                             limit 1), 'Not provided') as highestEducation,
                   c.location as location,
                   c.overall_experience_years as overallExperienceYears,
                   c.expected_salary_lakhs as expectedSalaryLakhs,
                   c.notice_period_days as noticePeriodDays,
                   coalesce((select string_agg(candidate_skill.skill, ', ' order by candidate_skill.skill)
                             from candidate_skills candidate_skill
                             where candidate_skill.candidate_id = c.id), '') as skills,
                   c.last_active_at as lastActiveAt,
                   c.updated_at as profileLastUpdatedAt,
                   (select count(*) from candidate_profile_engagements engagement
                    where engagement.candidate_id = c.id) as profileViewCount,
                   (select count(*) from candidate_profile_engagements engagement
                    where engagement.candidate_id = c.id and engagement.first_downloaded_at is not null) as profileDownloadCount,
                   ts_rank_cd(sourcing_index.search_vector,
                       to_tsquery('english', cast(:tsQuery as text))) as relevanceScore
            from candidates c
            join candidate_sourcing_index sourcing_index on sourcing_index.candidate_id = c.id
            where c.profile_searchable = true
              and (cast(:tsQuery as text) = ''
                   or sourcing_index.search_vector @@ to_tsquery('english', cast(:tsQuery as text)))
              and (:minimumExperienceYears is null or c.overall_experience_years >= :minimumExperienceYears)
              and (:maximumExperienceYears is null or c.overall_experience_years <= :maximumExperienceYears)
              and (:minimumSalaryLakhs is null or c.expected_salary_lakhs >= :minimumSalaryLakhs)
              and (:maximumSalaryLakhs is null or c.expected_salary_lakhs <= :maximumSalaryLakhs)
              and (cast(:location as text) = '' or c.location ilike concat('%', cast(:location as text), '%'))
              and (cast(:company as text) = '' or c.current_company ilike concat('%', cast(:company as text), '%'))
              and (cast(:designation as text) = '' or c.headline ilike concat('%', cast(:designation as text), '%'))
              and (cast(:bachelorsInstitution as text) = '' or exists (
                    select 1 from candidate_educations education
                    where education.candidate_id = c.id
                      and education.level = 'BACHELORS'
                      and education.institution_name ilike concat('%', cast(:bachelorsInstitution as text), '%')
              ))
              and (cast(:mastersInstitution as text) = '' or exists (
                    select 1 from candidate_educations education
                    where education.candidate_id = c.id
                      and education.level = 'MASTERS'
                      and education.institution_name ilike concat('%', cast(:mastersInstitution as text), '%')
              ))
              and (cast(:qualification as text) = '' or exists (
                    select 1 from candidate_educations education
                    where education.candidate_id = c.id
                      and education.degree_name ilike concat('%', cast(:qualification as text), '%')
              ))
              and (cast(:educationTypes as text[]) is null or exists (
                    select 1 from candidate_educations education
                    where education.candidate_id = c.id
                      and education.study_type = any(cast(:educationTypes as text[]))
              ))
              and (cast(:gender as text) = '' or lower(c.gender) = lower(cast(:gender as text)))
              and (:maximumNoticePeriodDays is null or c.notice_period_days <= :maximumNoticePeriodDays)
              and (:activeSince is null or c.last_active_at >= :activeSince)
              and (cast(:domainCategory as text) = '' or c.domain_category = cast(:domainCategory as text))
              and (cast(:requireGithub as boolean) = false or c.work_links::text ilike '%github%')
              and (cast(:requireLeetcode as boolean) = false or c.work_links::text ilike '%leetcode%')
              and (cast(:requirePortfolio as boolean) = false or c.work_links::text ~* '(behance|dribbble|portfolio|personal)')
            order by relevanceScore desc, c.updated_at desc
            """,
            countQuery = """
                    select count(*)
                    from candidates c
                    join candidate_sourcing_index sourcing_index on sourcing_index.candidate_id = c.id
                    where c.profile_searchable = true
                      and (cast(:tsQuery as text) = ''
                           or sourcing_index.search_vector @@ to_tsquery('english', cast(:tsQuery as text)))
                      and (:minimumExperienceYears is null or c.overall_experience_years >= :minimumExperienceYears)
                      and (:maximumExperienceYears is null or c.overall_experience_years <= :maximumExperienceYears)
                      and (:minimumSalaryLakhs is null or c.expected_salary_lakhs >= :minimumSalaryLakhs)
                      and (:maximumSalaryLakhs is null or c.expected_salary_lakhs <= :maximumSalaryLakhs)
                      and (cast(:location as text) = '' or c.location ilike concat('%', cast(:location as text), '%'))
                      and (cast(:company as text) = '' or c.current_company ilike concat('%', cast(:company as text), '%'))
                      and (cast(:designation as text) = '' or c.headline ilike concat('%', cast(:designation as text), '%'))
                      and (cast(:bachelorsInstitution as text) = '' or exists (
                            select 1 from candidate_educations education
                            where education.candidate_id = c.id
                              and education.level = 'BACHELORS'
                              and education.institution_name ilike concat('%', cast(:bachelorsInstitution as text), '%')
                      ))
                      and (cast(:mastersInstitution as text) = '' or exists (
                            select 1 from candidate_educations education
                            where education.candidate_id = c.id
                              and education.level = 'MASTERS'
                              and education.institution_name ilike concat('%', cast(:mastersInstitution as text), '%')
                      ))
                      and (cast(:qualification as text) = '' or exists (
                            select 1 from candidate_educations education
                            where education.candidate_id = c.id
                              and education.degree_name ilike concat('%', cast(:qualification as text), '%')
                      ))
                      and (cast(:educationTypes as text[]) is null or exists (
                            select 1 from candidate_educations education
                            where education.candidate_id = c.id
                              and education.study_type = any(cast(:educationTypes as text[]))
                      ))
                      and (cast(:gender as text) = '' or lower(c.gender) = lower(cast(:gender as text)))
                      and (:maximumNoticePeriodDays is null or c.notice_period_days <= :maximumNoticePeriodDays)
                      and (:activeSince is null or c.last_active_at >= :activeSince)
                      and (cast(:domainCategory as text) = '' or c.domain_category = cast(:domainCategory as text))
                      and (cast(:requireGithub as boolean) = false or c.work_links::text ilike '%github%')
                      and (cast(:requireLeetcode as boolean) = false or c.work_links::text ilike '%leetcode%')
                      and (cast(:requirePortfolio as boolean) = false or c.work_links::text ~* '(behance|dribbble|portfolio|personal)')
                    """,
            nativeQuery = true)
    Page<CandidateSourcingResult> searchVisibleCandidates(
            @Param("tsQuery") String tsQuery,
            @Param("minimumExperienceYears") Integer minimumExperienceYears,
            @Param("maximumExperienceYears") Integer maximumExperienceYears,
            @Param("minimumSalaryLakhs") Integer minimumSalaryLakhs,
            @Param("maximumSalaryLakhs") Integer maximumSalaryLakhs,
            @Param("location") String location,
            @Param("company") String company,
            @Param("designation") String designation,
            @Param("bachelorsInstitution") String bachelorsInstitution,
            @Param("mastersInstitution") String mastersInstitution,
            @Param("qualification") String qualification,
            @Param("educationTypes") String[] educationTypes,
            @Param("gender") String gender,
            @Param("maximumNoticePeriodDays") Integer maximumNoticePeriodDays,
            @Param("activeSince") Instant activeSince,
            @Param("domainCategory") String domainCategory,
            @Param("requireGithub") boolean requireGithub,
            @Param("requireLeetcode") boolean requireLeetcode,
            @Param("requirePortfolio") boolean requirePortfolio,
            Pageable pageable
    );
}

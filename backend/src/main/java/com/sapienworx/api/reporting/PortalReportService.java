package com.sapienworx.api.reporting;

import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.recruiter.CandidateEngagementMetrics;
import com.sapienworx.api.recruiter.CandidateProfileEngagementRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PortalReportService {
    private final JdbcTemplate jdbc;
    private final CandidateRepository candidates;
    private final RecruiterRepository recruiters;
    private final CandidateProfileEngagementRepository engagements;

    @Transactional(readOnly = true)
    public Map<String, Object> candidateReport(UUID candidateId, int requestedRangeDays) {
        requireFeature("candidate_reports");
        Candidate candidate = candidates.findById(candidateId).orElseThrow(() -> notFound("Candidate profile was not found."));
        int rangeDays = normalRange(requestedRangeDays);
        Instant rangeStart = Instant.now().minus(Duration.ofDays(rangeDays));
        CandidateEngagementMetrics engagement = engagements.metrics(candidateId, rangeStart, rangeStart.minus(Duration.ofDays(rangeDays)));
        Map<PipelineStage, Long> funnel = stageCounts("candidate_id", candidateId);
        long applications = funnel.values().stream().mapToLong(Long::longValue).sum();
        long interviews = funnel.get(PipelineStage.INTERVIEWING) + funnel.get(PipelineStage.FINAL_STAGE);
        long offers = funnel.get(PipelineStage.OFFER) + funnel.get(PipelineStage.ONBOARDED);
        long referrals = count("select count(*) from job_referrals where referrer_candidate_id = ?", candidateId);
        long successfulReferrals = count("""
                select count(*) from job_applications application
                join job_referrals referral on referral.id = application.referral_id
                where referral.referrer_candidate_id = ?
                """, candidateId);
        int completeness = profileCompleteness(candidate);

        Map<String, Object> metrics = map(
                "profileViews", engagement.totalViews(), "resumeDownloads", engagement.totalDownloads(),
                "applications", applications, "interviews", interviews, "offers", offers,
                "referralsShared", referrals, "successfulReferrals", successfulReferrals,
                "profileCompleteness", completeness, "applicationToInterviewRate", percent(interviews, applications),
                "interviewToOfferRate", percent(offers, interviews));

        List<Map<String, Object>> recentApplications = jdbc.query("""
                select application.id, job.public_job_id, job.title, organisation.name organisation,
                       application.pipeline_stage, application.applied_at, application.updated_at
                from job_applications application
                join jobs job on job.internal_id = application.job_internal_id
                join organisations organisation on organisation.id = job.organisation_id
                where application.candidate_id = ?
                order by application.updated_at desc limit 12
                """, (rs, row) -> map("id", rs.getString("id"), "jobId", rs.getString("public_job_id"),
                "title", rs.getString("title"), "organisation", rs.getString("organisation"),
                "stage", rs.getString("pipeline_stage"), "appliedAt", text(rs.getObject("applied_at")),
                "updatedAt", text(rs.getObject("updated_at"))), candidateId);

        List<Map<String, Object>> applicationTrend = jdbc.query("""
                select to_char(date_trunc('week', applied_at), 'DD Mon') period, count(*) total
                from job_applications where candidate_id = ? and applied_at >= ?
                group by date_trunc('week', applied_at) order by date_trunc('week', applied_at)
                """, (rs, row) -> map("period", rs.getString("period"), "value", rs.getLong("total")), candidateId, Timestamp.from(rangeStart));
        List<Map<String, Object>> engagementTrend = jdbc.query("""
                select to_char(date_trunc('week', last_viewed_at), 'DD Mon') period, count(*) views,
                       count(first_downloaded_at) downloads
                from candidate_profile_engagements where candidate_id = ? and last_viewed_at >= ?
                group by date_trunc('week', last_viewed_at) order by date_trunc('week', last_viewed_at)
                """, (rs, row) -> map("period", rs.getString("period"), "views", rs.getLong("views"),
                "downloads", rs.getLong("downloads")), candidateId, Timestamp.from(rangeStart));

        return map("rangeDays", rangeDays, "candidate", candidate.getFullName(), "generatedAt", Instant.now().toString(),
                "metrics", metrics, "funnel", funnelViews(funnel, applications), "applicationTrend", applicationTrend,
                "engagementTrend", engagementTrend, "recentApplications", recentApplications,
                "insights", candidateInsights(completeness, engagement.totalViews(), applications, interviews, offers));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> recruiterReport(UUID recruiterId, int requestedRangeDays) {
        requireFeature("recruiter_reports");
        Recruiter recruiter = recruiters.findById(recruiterId).orElseThrow(() -> notFound("Recruiter profile was not found."));
        int rangeDays = normalRange(requestedRangeDays);
        Instant rangeStart = Instant.now().minus(Duration.ofDays(rangeDays));
        Map<PipelineStage, Long> funnel = stageCounts("recipient_recruiter_id", recruiterId);
        long applications = funnel.values().stream().mapToLong(Long::longValue).sum();
        long offers = funnel.get(PipelineStage.OFFER) + funnel.get(PipelineStage.ONBOARDED);
        long onboarded = funnel.get(PipelineStage.ONBOARDED);
        long interviews = count("select count(*) from interviews where recruiter_id = ?", recruiterId);
        long activeJobs = count("select count(*) from jobs where created_by_recruiter_id = ? and status = 'ACTIVE'", recruiterId);
        long profileViews = count("select count(*) from candidate_profile_engagements where recruiter_id = ?", recruiterId);
        long downloads = count("select count(*) from candidate_profile_engagements where recruiter_id = ? and first_downloaded_at is not null", recruiterId);
        long outreachSent = count("""
                select count(*) from recruitment_campaign_recipients recipient
                join recruitment_campaigns campaign on campaign.id = recipient.campaign_id
                where campaign.recruiter_id = ? and recipient.delivery_status in ('SENT', 'REPLIED')
                """, recruiterId);
        long outreachReplies = count("""
                select count(*) from recruitment_campaign_recipients recipient
                join recruitment_campaigns campaign on campaign.id = recipient.campaign_id
                where campaign.recruiter_id = ? and recipient.delivery_status = 'REPLIED'
                """, recruiterId);
        Double averageResponseHours = jdbc.queryForObject("""
                select coalesce(avg(extract(epoch from (updated_at - applied_at)) / 3600.0), 0)
                from job_applications where recipient_recruiter_id = ? and updated_at > applied_at
                """, Double.class, recruiterId);

        Map<String, Object> metrics = map("activeJobs", activeJobs, "applications", applications, "interviews", interviews,
                "offers", offers, "onboarded", onboarded, "candidateProfilesViewed", profileViews,
                "resumesDownloaded", downloads, "outreachSent", outreachSent, "outreachReplies", outreachReplies,
                "applicationToOfferRate", percent(offers, applications), "offerToHireRate", percent(onboarded, offers),
                "outreachReplyRate", percent(outreachReplies, outreachSent),
                "averagePipelineUpdateHours", Math.round((averageResponseHours == null ? 0 : averageResponseHours) * 10d) / 10d);

        List<Map<String, Object>> jobPerformance = jdbc.query("""
                select job.public_job_id, job.title, job.status, job.published_at,
                       count(application.id) applicants,
                       count(application.id) filter (where application.pipeline_stage in ('OFFER', 'ONBOARDED')) offers,
                       count(application.id) filter (where application.pipeline_stage = 'ONBOARDED') hires
                from jobs job
                left join job_applications application on application.job_internal_id = job.internal_id
                where job.created_by_recruiter_id = ?
                group by job.internal_id order by job.updated_at desc limit 20
                """, (rs, row) -> map("jobId", rs.getString("public_job_id"), "title", rs.getString("title"),
                "status", rs.getString("status"), "publishedAt", text(rs.getObject("published_at")),
                "applicants", rs.getLong("applicants"), "offers", rs.getLong("offers"), "hires", rs.getLong("hires")), recruiterId);

        List<Map<String, Object>> applicationTrend = jdbc.query("""
                select to_char(date_trunc('week', applied_at), 'DD Mon') period, count(*) applications,
                       count(*) filter (where pipeline_stage in ('OFFER', 'ONBOARDED')) offers
                from job_applications where recipient_recruiter_id = ? and applied_at >= ?
                group by date_trunc('week', applied_at) order by date_trunc('week', applied_at)
                """, (rs, row) -> map("period", rs.getString("period"), "applications", rs.getLong("applications"),
                "offers", rs.getLong("offers")), recruiterId, Timestamp.from(rangeStart));

        List<Map<String, Object>> campaigns = jdbc.query("""
                select campaign.id, campaign.campaign_name, campaign.campaign_status, campaign.updated_at,
                       count(recipient.id) recipients,
                       count(recipient.id) filter (where recipient.delivery_status in ('SENT', 'REPLIED')) delivered,
                       count(recipient.id) filter (where recipient.delivery_status = 'REPLIED') replies
                from recruitment_campaigns campaign
                left join recruitment_campaign_recipients recipient on recipient.campaign_id = campaign.id
                where campaign.recruiter_id = ?
                group by campaign.id order by campaign.updated_at desc limit 12
                """, (rs, row) -> map("id", rs.getString("id"), "name", rs.getString("campaign_name"),
                "status", rs.getString("campaign_status"), "recipients", rs.getLong("recipients"),
                "delivered", rs.getLong("delivered"), "replies", rs.getLong("replies"),
                "updatedAt", text(rs.getObject("updated_at"))), recruiterId);

        return map("rangeDays", rangeDays, "recruiter", recruiter.getFullName(), "organisation", recruiter.getOrganisation().getName(),
                "generatedAt", Instant.now().toString(), "metrics", metrics, "funnel", funnelViews(funnel, applications),
                "applicationTrend", applicationTrend, "jobPerformance", jobPerformance, "campaigns", campaigns,
                "insights", recruiterInsights(activeJobs, applications, offers, outreachSent, outreachReplies));
    }

    @Transactional(readOnly = true)
    public String candidateCsv(UUID candidateId, int rangeDays) { return csv(candidateReport(candidateId, rangeDays)); }

    @Transactional(readOnly = true)
    public String recruiterCsv(UUID recruiterId, int rangeDays) { return csv(recruiterReport(recruiterId, rangeDays)); }

    private Map<PipelineStage, Long> stageCounts(String ownerColumn, UUID ownerId) {
        Map<PipelineStage, Long> result = new EnumMap<>(PipelineStage.class);
        for (PipelineStage stage : PipelineStage.values()) result.put(stage, 0L);
        for (Map<String, Object> row : jdbc.queryForList(
                "select pipeline_stage, count(*) total from job_applications where " + ownerColumn + " = ? group by pipeline_stage", ownerId)) {
            result.put(PipelineStage.valueOf(String.valueOf(row.get("pipeline_stage"))), ((Number) row.get("total")).longValue());
        }
        return result;
    }

    private List<Map<String, Object>> funnelViews(Map<PipelineStage, Long> funnel, long total) {
        return funnel.entrySet().stream().map(entry -> map("stage", entry.getKey().name(), "count", entry.getValue(),
                "percent", percent(entry.getValue(), total))).toList();
    }

    private List<String> candidateInsights(int completeness, long views, long applications, long interviews, long offers) {
        List<String> insights = new ArrayList<>();
        if (completeness < 80) insights.add("Complete the remaining profile sections to improve sourcing visibility.");
        if (views == 0) insights.add("Make the profile searchable and add role-specific skills to start appearing in recruiter searches.");
        if (applications > 0 && interviews == 0) insights.add("Tailor the resume headline and key skills to each role before applying.");
        if (interviews > 0 && offers == 0) insights.add("Review interview feedback and keep availability details current.");
        if (insights.isEmpty()) insights.add("Your profile and hiring funnel are healthy. Keep activity and availability current.");
        return insights;
    }

    private List<String> recruiterInsights(long activeJobs, long applications, long offers, long outreachSent, long outreachReplies) {
        List<String> insights = new ArrayList<>();
        if (activeJobs == 0) insights.add("Publish an active role to begin collecting applications.");
        if (applications > 0 && offers == 0) insights.add("Review stage ageing and move qualified candidates into structured interviews.");
        if (outreachSent > 0 && percent(outreachReplies, outreachSent) < 10) insights.add("Personalise campaign content and tighten the sourcing criteria to improve replies.");
        if (insights.isEmpty()) insights.add("Your hiring funnel is moving. Monitor job-level conversion and response time each week.");
        return insights;
    }

    private int profileCompleteness(Candidate candidate) {
        int completed = 0;
        if (!blank(candidate.getHeadline())) completed++;
        if (!blank(candidate.getLocation())) completed++;
        if (candidate.getOverallExperienceYears() != null) completed++;
        if (!blank(candidate.getProfileSummary())) completed++;
        if (!candidate.getSkills().isEmpty()) completed++;
        if (!candidate.getEducation().isEmpty()) completed++;
        if (!candidate.getInterestedDomains().isEmpty()) completed++;
        if (!candidate.getWorkLinks().isEmpty()) completed++;
        if (candidate.isEmailVerified()) completed++;
        if (candidate.isMobileVerified()) completed++;
        return Math.round(completed * 10f);
    }

    @SuppressWarnings("unchecked")
    private String csv(Map<String, Object> report) {
        StringBuilder csv = new StringBuilder("metric,value\n");
        Map<String, Object> metrics = (Map<String, Object>) report.get("metrics");
        metrics.forEach((key, value) -> csv.append(escape(key)).append(',').append(escape(String.valueOf(value))).append('\n'));
        return csv.toString();
    }

    private long count(String sql, UUID id) { Long value = jdbc.queryForObject(sql, Long.class, id); return value == null ? 0 : value; }
    private void requireFeature(String key) {
        List<Map<String, Object>> flags = jdbc.queryForList("select enabled, rollout_percent from platform_feature_flags where flag_key = ?", key);
        if (flags.isEmpty() || !Boolean.TRUE.equals(flags.get(0).get("enabled")) || ((Number) flags.get(0).get("rollout_percent")).intValue() == 0) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Reports are temporarily unavailable for this workspace.");
        }
    }
    private int percent(long numerator, long denominator) { return denominator == 0 ? 0 : (int) Math.round((numerator * 100d) / denominator); }
    private int normalRange(int requested) { return requested == 7 || requested == 30 || requested == 90 ? requested : 90; }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    private String text(Object value) { return value == null ? "" : String.valueOf(value); }
    private String escape(String value) { return '"' + value.replace("\"", "\"\"") + '"'; }
    private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }
    private Map<String, Object> map(Object... values) { Map<String, Object> result = new LinkedHashMap<>(); for (int index = 0; index < values.length; index += 2) result.put(String.valueOf(values[index]), values[index + 1]); return result; }
}

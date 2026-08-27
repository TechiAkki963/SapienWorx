package com.sapienworx.api.recruiter;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Stores one immutable first-view/download marker per recruiter and candidate. */
@Repository
@RequiredArgsConstructor
public class CandidateProfileEngagementRepository {
    private final EntityManager entityManager;

    public void recordView(UUID candidateId, UUID recruiterId) {
        entityManager.createNativeQuery("""
                insert into candidate_profile_engagements (candidate_id, recruiter_id, first_viewed_at, last_viewed_at)
                values (:candidateId, :recruiterId, now(), now())
                on conflict (candidate_id, recruiter_id) do update
                    set last_viewed_at = excluded.last_viewed_at
                """)
                .setParameter("candidateId", candidateId)
                .setParameter("recruiterId", recruiterId)
                .executeUpdate();
    }

    public void recordDownload(UUID candidateId, UUID recruiterId) {
        entityManager.createNativeQuery("""
                insert into candidate_profile_engagements (candidate_id, recruiter_id, first_viewed_at, last_viewed_at, first_downloaded_at)
                values (:candidateId, :recruiterId, now(), now(), now())
                on conflict (candidate_id, recruiter_id) do update
                    set last_viewed_at = excluded.last_viewed_at,
                        first_downloaded_at = coalesce(candidate_profile_engagements.first_downloaded_at, excluded.first_downloaded_at)
                """)
                .setParameter("candidateId", candidateId)
                .setParameter("recruiterId", recruiterId)
                .executeUpdate();
    }

    public long viewCount(UUID candidateId) {
        return ((Number) entityManager.createNativeQuery("select count(*) from candidate_profile_engagements where candidate_id = :candidateId")
                .setParameter("candidateId", candidateId).getSingleResult()).longValue();
    }

    public long downloadCount(UUID candidateId) {
        return ((Number) entityManager.createNativeQuery("""
                select count(*) from candidate_profile_engagements
                where candidate_id = :candidateId and first_downloaded_at is not null
                """).setParameter("candidateId", candidateId).getSingleResult()).longValue();
    }

    /**
     * Counts are based on unique recruiter-candidate engagement records. This
     * keeps the candidate's dashboard useful without inflating its metrics for
     * every revisit to the same profile.
     */
    public CandidateEngagementMetrics metrics(UUID candidateId, Instant currentPeriodStart, Instant previousPeriodStart) {
        Object[] row = (Object[]) entityManager.createNativeQuery("""
                select count(*) as total_views,
                       coalesce(sum(case when first_downloaded_at is not null then 1 else 0 end), 0) as total_downloads,
                       coalesce(sum(case when last_viewed_at >= :currentStart then 1 else 0 end), 0) as current_views,
                       coalesce(sum(case when first_downloaded_at >= :currentStart then 1 else 0 end), 0) as current_downloads,
                       coalesce(sum(case when last_viewed_at >= :previousStart and last_viewed_at < :currentStart then 1 else 0 end), 0) as previous_views,
                       coalesce(sum(case when first_downloaded_at >= :previousStart and first_downloaded_at < :currentStart then 1 else 0 end), 0) as previous_downloads
                from candidate_profile_engagements
                where candidate_id = :candidateId
                """)
                .setParameter("candidateId", candidateId)
                .setParameter("currentStart", currentPeriodStart)
                .setParameter("previousStart", previousPeriodStart)
                .getSingleResult();
        return new CandidateEngagementMetrics(number(row[0]), number(row[1]), number(row[2]), number(row[3]), number(row[4]), number(row[5]));
    }

    @SuppressWarnings("unchecked")
    public List<CandidateEngagementActivity> recentActivity(UUID candidateId, int limit) {
        List<Object[]> rows = entityManager.createNativeQuery("""
                select recruiter.full_name, recruiter.designation, organisation.name,
                       engagement.last_viewed_at, engagement.first_downloaded_at
                from candidate_profile_engagements engagement
                join recruiters recruiter on recruiter.id = engagement.recruiter_id
                join organisations organisation on organisation.id = recruiter.organisation_id
                where engagement.candidate_id = :candidateId
                order by engagement.last_viewed_at desc
                """)
                .setParameter("candidateId", candidateId)
                .setMaxResults(Math.max(1, Math.min(limit, 20)))
                .getResultList();
        return rows.stream().map(row -> {
            Instant viewedAt = instant(row[3]);
            Instant downloadedAt = instant(row[4]);
            boolean downloaded = downloadedAt != null && !downloadedAt.isBefore(viewedAt);
            return new CandidateEngagementActivity((String) row[0], (String) row[1], (String) row[2],
                    downloaded ? "RESUME_DOWNLOADED" : "PROFILE_VIEWED", downloaded ? downloadedAt : viewedAt);
        }).toList();
    }

    private long number(Object value) { return value == null ? 0L : ((Number) value).longValue(); }
    private Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof OffsetDateTime offsetDateTime) return offsetDateTime.toInstant();
        throw new IllegalArgumentException("Unsupported engagement timestamp value.");
    }
}

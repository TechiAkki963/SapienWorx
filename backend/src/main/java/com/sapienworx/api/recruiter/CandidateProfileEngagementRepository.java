package com.sapienworx.api.recruiter;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

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
}

package com.sapienworx.api.admin;

import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.candidate.CandidateWorkspaceService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/** Executes only explicit erasure requests after the configured safety period. */
@Service
@Slf4j
public class PrivacyRetentionPurgeService {
    private final CandidateRepository candidates;
    private final CandidateWorkspaceService workspace;
    private final boolean enabled;
    private final int graceDays;

    public PrivacyRetentionPurgeService(CandidateRepository candidates, CandidateWorkspaceService workspace,
                                        @Value("${app.privacy.retention-purge-enabled:false}") boolean enabled,
                                        @Value("${app.privacy.erasure-grace-days:30}") int graceDays) {
        this.candidates = candidates;
        this.workspace = workspace;
        this.enabled = enabled;
        this.graceDays = Math.max(1, graceDays);
    }

    @Scheduled(cron = "${app.privacy.retention-purge-cron:0 30 2 * * *}")
    public void purgeExplicitErasureRequests() {
        if (!enabled) return;
        Instant cutoff = Instant.now().minus(graceDays, ChronoUnit.DAYS);
        for (Candidate candidate : candidates.findByDeletionRequestedTrueAndUpdatedAtBefore(cutoff)) {
            try { workspace.erase(candidate.getId()); }
            catch (RuntimeException exception) { log.error("Privacy erasure failed for candidate {}", candidate.getId(), exception); }
        }
    }
}

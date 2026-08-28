package com.sapienworx.api.admin;

import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.PlatformRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * The single enforcement point for Master Access decisions.  UI switches are
 * never treated as enforcement; API entry points call this policy as well.
 */
@Service
@RequiredArgsConstructor
public class PlatformAccessPolicy {
    private final PlatformControlsRepository controlsRepository;
    private final PlatformSubjectControlRepository subjectControls;
    private final RecruiterRepository recruiters;
    private final CandidateRepository candidates;
    private final JobRepository jobs;

    @Transactional(readOnly = true)
    public AccessDecision accessFor(AuthenticatedUser user) {
        if (user == null) return AccessDecision.denied(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        if (user.role() == PlatformRole.SUPER_ADMIN) return AccessDecision.allowed();
        if (controls().isMaintenanceMode()) return AccessDecision.denied(HttpStatus.SERVICE_UNAVAILABLE, "Sapienworx is temporarily in maintenance mode.");
        if (user.role() == PlatformRole.CANDIDATE) {
            if (!candidates.existsById(user.userId())) return AccessDecision.denied(HttpStatus.UNAUTHORIZED, "This account is no longer available.");
            return subjectIssue(PlatformSubjectType.CANDIDATE, user.userId());
        }
        if (user.role() == PlatformRole.RECRUITER) {
            return recruiters.findById(user.userId()).map(recruiter -> {
                AccessDecision person = subjectIssue(PlatformSubjectType.RECRUITER, user.userId());
                return person.permitted() ? subjectIssue(PlatformSubjectType.ORGANISATION, recruiter.getOrganisation().getId()) : person;
            }).orElseGet(() -> AccessDecision.denied(HttpStatus.UNAUTHORIZED, "This account is no longer available."));
        }
        return AccessDecision.allowed();
    }

    public void requireSignInAllowed(AuthenticatedUser user) {
        AccessDecision decision = accessFor(user);
        if (!decision.permitted()) throw new ResponseStatusException(decision.status(), decision.message());
    }

    @Transactional(readOnly = true)
    public void requireCvParsingEnabled() {
        if (!controls().isCvParsingEnabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "CV parsing is temporarily unavailable. Please save your profile manually or try again shortly.");
    }

    @Transactional(readOnly = true)
    public void requirePublicPlatformAvailable() {
        if (controls().isMaintenanceMode()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Sapienworx is temporarily in maintenance mode. Please try again shortly.");
    }

    @Transactional(readOnly = true)
    public void requireCampaignsEnabled() {
        if (!controls().isCampaignsEnabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Recruiter campaigns are temporarily unavailable.");
    }

    @Transactional(readOnly = true)
    public void requireJobCreationAllowed(UUID organisationId) {
        PlatformSubjectControl control = subjectControls.findBySubjectTypeAndSubjectId(PlatformSubjectType.ORGANISATION, organisationId).orElse(null);
        if (control != null && control.isSuspended()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This organisation has been suspended by Sapienworx.");
        if (control != null && control.getPostingLimit() > 0) {
            long count = jobs.countByOrganisation_IdAndStatusIn(organisationId, List.of(JobStatus.DRAFT, JobStatus.ACTIVE));
            if (count >= control.getPostingLimit()) throw new ResponseStatusException(HttpStatus.CONFLICT, "This organisation has reached its platform job posting limit.");
        }
    }

    @Transactional(readOnly = true)
    public boolean isSessionRevoked(AuthenticatedUser user, java.time.Instant tokenIssuedAt) {
        if (user == null || user.role() == PlatformRole.SUPER_ADMIN || tokenIssuedAt == null) return false;
        PlatformSubjectType type = user.role() == PlatformRole.CANDIDATE ? PlatformSubjectType.CANDIDATE : PlatformSubjectType.RECRUITER;
        PlatformSubjectControl direct = subjectControls.findBySubjectTypeAndSubjectId(type, user.userId()).orElse(null);
        if (direct != null && direct.getSessionInvalidAfter() != null && !tokenIssuedAt.isAfter(direct.getSessionInvalidAfter())) return true;
        if (user.role() == PlatformRole.RECRUITER) {
            return recruiters.findById(user.userId()).map(recruiter -> subjectControls.findBySubjectTypeAndSubjectId(PlatformSubjectType.ORGANISATION, recruiter.getOrganisation().getId())
                    .map(control -> control.getSessionInvalidAfter() != null && !tokenIssuedAt.isAfter(control.getSessionInvalidAfter())).orElse(false)).orElse(true);
        }
        return false;
    }

    private PlatformControls controls() { return controlsRepository.findById(true).orElseGet(PlatformControls::new); }
    private AccessDecision subjectIssue(PlatformSubjectType type, UUID id) {
        return subjectControls.findBySubjectTypeAndSubjectId(type, id).map(control -> {
            if (control.isSuspended()) return AccessDecision.denied(HttpStatus.FORBIDDEN, control.getReason() == null || control.getReason().isBlank() ? "This account has been suspended by Sapienworx." : "Access is currently unavailable: " + control.getReason());
            if (control.isPasswordResetRequired()) return AccessDecision.denied(HttpStatus.LOCKED, "A password reset is required before this account can sign in.");
            return AccessDecision.allowed();
        }).orElseGet(AccessDecision::allowed);
    }

    public record AccessDecision(boolean permitted, HttpStatus status, String message) {
        static AccessDecision allowed() { return new AccessDecision(true, HttpStatus.OK, ""); }
        static AccessDecision denied(HttpStatus status, String message) { return new AccessDecision(false, status, message); }
    }
}

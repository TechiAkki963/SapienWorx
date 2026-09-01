package com.sapienworx.api.offer;

import com.sapienworx.api.job.WorkplaceModel;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class OfferResponses {
    private OfferResponses() { }

    public record Entitlement(String planName, int maximumApprovers, boolean advancedApprovals,
                              boolean customBranding, boolean auditExport) { }

    public record RecruiterWorkspace(UUID currentRecruiterId, Entitlement entitlement, Details offer) { }

    public record CandidateWorkspace(CandidateOffer offer) { }

    public record Details(
            UUID offerId, UUID applicationId, String jobId, String jobTitle, String candidateName,
            OfferStatus status, int version, String designation, LocalDate joiningDate,
            WorkplaceModel workplaceModel, int probationMonths, boolean noticeBuyout, Instant expiresAt,
            String currency, BigDecimal annualFixedAmount, BigDecimal annualVariableAmount,
            BigDecimal joiningBonus, BigDecimal retentionBonus, String otherCompensation,
            String candidateMessage, String termsText, Instant sentAt, Instant respondedAt, String responseNote,
            boolean editable, boolean submittable, boolean sendable, boolean withdrawable, boolean approvable,
            List<Approval> approvals, List<Version> versions
    ) { }

    public record Approval(UUID approvalId, UUID recruiterId, String recruiterName,
                           OfferApprovalDecision decision, String comments, Instant decidedAt) { }

    public record Version(int version, String designation, String currency, BigDecimal totalCompensation,
                          String createdBy, Instant createdAt) { }

    public record CandidateOffer(
            UUID offerId, UUID applicationId, String jobTitle, String organisationName, OfferStatus status,
            int version, String designation, LocalDate joiningDate, WorkplaceModel workplaceModel,
            int probationMonths, boolean noticeBuyout, Instant expiresAt, String currency,
            BigDecimal annualFixedAmount, BigDecimal annualVariableAmount, BigDecimal joiningBonus,
            BigDecimal retentionBonus, String otherCompensation, String candidateMessage, String termsText,
            Instant sentAt, Instant respondedAt, String responseNote, boolean canRespond
    ) { }
}

package com.sapienworx.api.offer;

import com.sapienworx.api.job.WorkplaceModel;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class OfferRequests {
    private OfferRequests() { }

    public record Draft(
            Integer expectedVersion,
            @NotBlank @Size(max = 200) String designation,
            @NotNull LocalDate joiningDate,
            @NotNull WorkplaceModel workplaceModel,
            @Min(0) @Max(36) int probationMonths,
            boolean noticeBuyout,
            @NotNull Instant expiresAt,
            @NotBlank @Pattern(regexp = "^[A-Za-z]{3}$") String currency,
            @NotNull @DecimalMin("0.00") BigDecimal annualFixedAmount,
            @NotNull @DecimalMin("0.00") BigDecimal annualVariableAmount,
            @NotNull @DecimalMin("0.00") BigDecimal joiningBonus,
            @NotNull @DecimalMin("0.00") BigDecimal retentionBonus,
            @Size(max = 4000) String otherCompensation,
            @Size(max = 4000) String candidateMessage,
            @Size(max = 12000) String termsText,
            @NotNull @Size(max = 12) List<UUID> approverRecruiterIds
    ) { }

    public record VersionAction(@Min(1) int expectedVersion) { }

    public record Approval(@Min(1) int expectedVersion, @NotNull OfferApprovalDecision decision,
                           @Size(max = 1000) String comments) { }

    public enum CandidateDecision { ACCEPT, DECLINE }

    public record CandidateResponse(@Min(1) int expectedVersion, @NotNull CandidateDecision decision,
                                    @Size(max = 1000) String note) { }
}

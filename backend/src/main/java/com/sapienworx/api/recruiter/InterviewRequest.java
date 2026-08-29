package com.sapienworx.api.recruiter;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;
import java.util.List;

public record InterviewRequest(
        @NotNull UUID applicationId,
        @NotBlank @Size(max = 80) String platformName,
        @NotBlank @Size(max = 2048) String meetingLink,
        @NotNull @Future Instant scheduledAt,
        @Min(5) @Max(480) int durationMinutes,
        @Size(max = 80) String timeZone,
        @Size(max = 2000) String agenda,
        List<UUID> panelRecruiterIds
) { }

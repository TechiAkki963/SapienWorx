package com.sapienworx.api.auth;

import com.sapienworx.api.otp.OtpChannel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record OtpVerificationRequest(
        @NotBlank String transactionId,
        @NotNull OtpChannel channel,
        @Pattern(regexp = "\\d{6}", message = "OTP must contain six digits.") String code,
        Boolean trustDevice
) {
}

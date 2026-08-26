package com.sapienworx.api.auth;

import com.sapienworx.api.security.PlatformRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** A single shape keeps the browser from creating role-specific OTP side channels. */
public record OtpRequest(
        @NotNull AuthFlow flow,
        PlatformRole role,
        String fullName,
        @Email String email,
        String mobile,
        @Size(min = 8, max = 128) String password,
        Boolean termsAccepted,
        Boolean automationConsent,
        String organisationName,
        String designation,
        String location,
        String firstName,
        String lastName,
        String city,
        String state
) {
}

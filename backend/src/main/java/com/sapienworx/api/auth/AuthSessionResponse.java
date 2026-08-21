package com.sapienworx.api.auth;

import com.sapienworx.api.otp.OtpChannel;
import com.sapienworx.api.security.PlatformRole;

import java.util.Set;
import java.util.UUID;

public record AuthSessionResponse(
        boolean authenticated,
        UUID userId,
        PlatformRole role,
        String redirectTo,
        Set<OtpChannel> remainingChannels
) {
    static AuthSessionResponse pending(Set<OtpChannel> remainingChannels) {
        return new AuthSessionResponse(false, null, null, null, remainingChannels);
    }
}

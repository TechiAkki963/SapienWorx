package com.sapienworx.api.otp;

import java.util.UUID;

/** Queue-only payload. It is never logged or returned to the browser. */
public record OtpDispatchPayload(
        UUID dispatchId,
        String transactionId,
        OtpChannel channel,
        String destination,
        String plainTextOtp
) {
}

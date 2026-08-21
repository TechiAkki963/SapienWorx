package com.sapienworx.api.otp;

/**
 * Adapter boundary for the email/SMS queue producer. Implementations must not
 * log the plaintext OTP or raw recipient address.
 */
public interface OtpDeliveryGateway {
    void dispatch(String transactionId, OtpChannel channel, String destination, String plainTextOtp);
}

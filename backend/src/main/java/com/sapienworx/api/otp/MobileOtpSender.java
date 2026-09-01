package com.sapienworx.api.otp;

public interface MobileOtpSender {
    void send(OtpDispatchPayload payload);
}

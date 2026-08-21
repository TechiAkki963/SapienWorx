package com.sapienworx.api.auth;

import com.sapienworx.api.otp.OtpChannel;

import java.util.Set;

public record OtpRequestResponse(String transactionId, Set<OtpChannel> requiredChannels) {
}

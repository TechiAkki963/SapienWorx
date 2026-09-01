package com.sapienworx.api.otp;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;

/**
 * Redis-backed OTP store. Keys contain a random registration transaction ID,
 * not email addresses or mobile numbers, and values contain only bcrypt hashes.
 */
@Service
@RequiredArgsConstructor
public class OtpChallengeStore {

    static final Duration OTP_TTL = Duration.ofMinutes(10);
    static final int MAX_ATTEMPTS = 5;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final StringRedisTemplate redisTemplate;
    private final PasswordEncoder passwordEncoder;
    private final ObjectProvider<QaOtpBypass> qaOtpBypass;

    public String issue(String transactionId, OtpPurpose purpose, OtpChannel channel) {
        String code = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        redisTemplate.opsForValue().set(key(transactionId, purpose, channel), passwordEncoder.encode(code), OTP_TTL);
        return code;
    }

    /** OTPs are single-use: successful verification deletes the matching Redis key. */
    public boolean verify(String transactionId, OtpPurpose purpose, OtpChannel channel, String submittedCode) {
        String key = key(transactionId, purpose, channel);
        String attemptsKey = attemptsKey(transactionId, purpose, channel);
        String attemptsValue = redisTemplate.opsForValue().get(attemptsKey);
        if (attemptsValue != null && Integer.parseInt(attemptsValue) >= MAX_ATTEMPTS) return false;
        QaOtpBypass bypass = qaOtpBypass.getIfAvailable();
        if (bypass != null && bypass.matches(submittedCode)) {
            // The authentication transaction and required channel are still
            // validated by AuthenticationService before this shortcut runs.
            redisTemplate.delete(key);
            redisTemplate.delete(attemptsKey);
            return true;
        }
        String encodedCode = redisTemplate.opsForValue().get(key);
        if (encodedCode == null || !passwordEncoder.matches(submittedCode, encodedCode)) {
            Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
            if (attempts != null && attempts == 1) redisTemplate.expire(attemptsKey, OTP_TTL);
            return false;
        }
        redisTemplate.delete(key);
        redisTemplate.delete(attemptsKey);
        return true;
    }

    public boolean attemptsExceeded(String transactionId, OtpPurpose purpose, OtpChannel channel) {
        String value = redisTemplate.opsForValue().get(attemptsKey(transactionId, purpose, channel));
        return value != null && Integer.parseInt(value) >= MAX_ATTEMPTS;
    }

    private String key(String transactionId, OtpPurpose purpose, OtpChannel channel) {
        return "sapienworx:otp:" + purpose.name().toLowerCase() + ":" + transactionId + ":" + channel.name().toLowerCase();
    }
    private String attemptsKey(String transactionId, OtpPurpose purpose, OtpChannel channel) {
        return key(transactionId, purpose, channel) + ":attempts";
    }
}

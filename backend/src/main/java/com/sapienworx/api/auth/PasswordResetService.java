package com.sapienworx.api.auth;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.otp.OtpChallengeStore;
import com.sapienworx.api.otp.OtpChannel;
import com.sapienworx.api.otp.OtpDeliveryGateway;
import com.sapienworx.api.otp.OtpPurpose;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.security.PlatformRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PasswordResetService {
    private static final Duration RESET_TTL = Duration.ofMinutes(10);
    private static final String PREFIX = "sapienworx:auth:password-reset:";
    private static final String COOLDOWN_PREFIX = "sapienworx:auth:password-reset-cooldown:";
    private static final Duration REQUEST_COOLDOWN = Duration.ofSeconds(60);

    private final CandidateRepository candidates;
    private final RecruiterRepository recruiters;
    private final OtpChallengeStore challenges;
    private final OtpDeliveryGateway delivery;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final PasswordEncoder passwordEncoder;
    private final AccountSessionService sessions;

    public ResetRequested request(PasswordResetRequest request) {
        PlatformRole role = request.role();
        if (role != PlatformRole.CANDIDATE && role != PlatformRole.RECRUITER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose Candidate or Recruiter account recovery.");
        }
        String email = request.email() == null ? "" : request.email().trim().toLowerCase(Locale.ROOT);
        Boolean requestAllowed = redis.opsForValue().setIfAbsent(COOLDOWN_PREFIX + fingerprint(role + ":" + email), "1", REQUEST_COOLDOWN);
        if (!Boolean.TRUE.equals(requestAllowed)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "A recovery email was recently requested. Please wait one minute and try again.");
        }
        UUID userId = role == PlatformRole.CANDIDATE
                ? candidates.findByEmail(email).map(Candidate::getId).orElse(null)
                : recruiters.findByOfficialEmail(email).map(Recruiter::getId).orElse(null);
        String transactionId = UUID.randomUUID().toString();
        save(transactionId, new PendingPasswordReset(userId, role, email));
        if (userId != null) {
            String code = challenges.issue(transactionId, OtpPurpose.PASSWORD_RESET, OtpChannel.EMAIL);
            delivery.dispatch(transactionId, OtpPurpose.PASSWORD_RESET, OtpChannel.EMAIL, email, code);
        }
        return new ResetRequested(transactionId,
                "If this email belongs to a " + (role == PlatformRole.CANDIDATE ? "candidate" : "recruiter") + " account, a six-digit reset code has been sent.");
    }

    @Transactional
    public void confirm(PasswordResetConfirmation request) {
        PendingPasswordReset pending = find(request.transactionId());
        if (pending.userId() == null || !challenges.verify(request.transactionId(), OtpPurpose.PASSWORD_RESET, OtpChannel.EMAIL, request.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "That reset code is invalid or has expired.");
        }
        if (request.newPassword() == null || request.newPassword().length() < 8 || request.newPassword().length() > 128) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Use a new password between 8 and 128 characters.");
        }
        String hash = passwordEncoder.encode(request.newPassword());
        if (pending.role() == PlatformRole.CANDIDATE) {
            Candidate candidate = candidates.findById(pending.userId()).orElseThrow(() -> resetExpired());
            if (candidate.getPasswordHash() != null
                    && passwordEncoder.matches(request.newPassword(), candidate.getPasswordHash())) throw passwordReuse();
            candidate.setPasswordHash(hash);
        } else {
            Recruiter recruiter = recruiters.findById(pending.userId()).orElseThrow(() -> resetExpired());
            if (recruiter.getPasswordHash() != null
                    && passwordEncoder.matches(request.newPassword(), recruiter.getPasswordHash())) throw passwordReuse();
            recruiter.setPasswordHash(hash);
        }
        sessions.revokeAll(pending.userId(), pending.role());
        redis.delete(PREFIX + request.transactionId());
    }

    private void save(String transactionId, PendingPasswordReset pending) {
        try {
            redis.opsForValue().set(PREFIX + transactionId, objectMapper.writeValueAsString(pending), RESET_TTL);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to start password recovery.");
        }
    }

    private PendingPasswordReset find(String transactionId) {
        try {
            String value = redis.opsForValue().get(PREFIX + transactionId);
            if (value == null) throw resetExpired();
            return objectMapper.readValue(value, PendingPasswordReset.class);
        } catch (JsonProcessingException exception) {
            throw resetExpired();
        }
    }

    private ResponseStatusException resetExpired() {
        return new ResponseStatusException(HttpStatus.GONE, "This password reset request has expired. Start again.");
    }

    private ResponseStatusException passwordReuse() {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a password you have not just been using.");
    }

    private String fingerprint(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 must be available for recovery rate limiting.", exception);
        }
    }

    record PendingPasswordReset(UUID userId, PlatformRole role, String email) { }
    public record PasswordResetRequest(@NotNull PlatformRole role, @NotBlank @Email String email) { }
    public record PasswordResetConfirmation(@NotBlank String transactionId,
                                            @NotBlank @Pattern(regexp = "\\d{6}") String code,
                                            @NotBlank @Size(min = 8, max = 128) String newPassword) { }
    public record ResetRequested(String transactionId, String message) { }
}

package com.sapienworx.api.auth;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.JwtTokenService;
import com.sapienworx.api.security.PlatformRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccountSessionService {
    private static final Duration TRUSTED_DEVICE_TTL = Duration.ofDays(30);
    private static final Duration TOUCH_INTERVAL = Duration.ofMinutes(5);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AccountSessionRepository sessions;
    private final JwtTokenService jwtTokenService;

    @Transactional
    public SessionGrant create(AuthenticatedUser user, String userAgent, String locationHint, boolean trustDevice) {
        Instant now = Instant.now();
        UUID sessionId = UUID.randomUUID();
        String trustedToken = trustDevice ? randomToken() : null;
        AccountSession session = AccountSession.builder()
                .id(sessionId)
                .userId(user.userId())
                .role(user.role())
                .deviceName(deviceName(userAgent))
                .locationHint(safeLocationHint(locationHint))
                .trustedDeviceTokenHash(trustedToken == null ? null : fingerprint(trustedToken))
                .trustedDevice(trustDevice)
                .createdAt(now)
                .lastSeenAt(now)
                .sessionExpiresAt(now.plus(jwtTokenService.ttl()))
                .trustedUntil(trustDevice ? now.plus(TRUSTED_DEVICE_TTL) : null)
                .build();
        sessions.save(session);
        return new SessionGrant(user.withSession(sessionId), trustedToken);
    }

    @Transactional(readOnly = true)
    public boolean isTrustedCandidateDevice(UUID candidateId, String trustedToken) {
        if (trustedToken == null || trustedToken.isBlank()) return false;
        return sessions.findByUserIdAndRoleAndTrustedDeviceTokenHash(candidateId, PlatformRole.CANDIDATE, fingerprint(trustedToken))
                .map(session -> session.trustedAt(Instant.now()))
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public boolean isActive(UUID sessionId, UUID userId, PlatformRole role) {
        if (sessionId == null) return false;
        return sessions.findById(sessionId)
                .filter(session -> session.getUserId().equals(userId) && session.getRole() == role)
                .map(session -> session.activeAt(Instant.now()))
                .orElse(false);
    }

    @Transactional
    public void touch(UUID sessionId) {
        if (sessionId == null) return;
        sessions.findById(sessionId).ifPresent(session -> {
            Instant now = Instant.now();
            if (session.activeAt(now) && session.getLastSeenAt().isBefore(now.minus(TOUCH_INTERVAL))) {
                session.setLastSeenAt(now);
            }
        });
    }

    @Transactional(readOnly = true)
    public List<SessionView> list(AuthenticatedUser user) {
        requireSessionUser(user);
        Instant now = Instant.now();
        return sessions.findByUserIdAndRoleOrderByLastSeenAtDesc(user.userId(), user.role()).stream()
                .filter(session -> session.getRevokedAt() == null)
                .map(session -> new SessionView(session.getId(), session.getDeviceName(), session.getLocationHint(),
                        session.isTrustedDevice() && session.getTrustedUntil() != null && session.getTrustedUntil().isAfter(now),
                        session.getId().equals(user.sessionId()), session.getCreatedAt(), session.getLastSeenAt(),
                        session.getSessionExpiresAt(), session.getTrustedUntil()))
                .toList();
    }

    @Transactional
    public boolean revoke(AuthenticatedUser user, UUID sessionId) {
        requireSessionUser(user);
        AccountSession session = sessions.findById(sessionId)
                .filter(value -> value.getUserId().equals(user.userId()) && value.getRole() == user.role())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "That session is no longer available."));
        session.setRevokedAt(Instant.now());
        session.setTrustedDevice(false);
        session.setTrustedDeviceTokenHash(null);
        return sessionId.equals(user.sessionId());
    }

    @Transactional
    public void revokeOthers(AuthenticatedUser user) {
        requireSessionUser(user);
        Instant now = Instant.now();
        sessions.findByUserIdAndRoleOrderByLastSeenAtDesc(user.userId(), user.role()).stream()
                .filter(session -> !session.getId().equals(user.sessionId()) && session.getRevokedAt() == null)
                .forEach(session -> {
                    session.setRevokedAt(now);
                    session.setTrustedDevice(false);
                    session.setTrustedDeviceTokenHash(null);
                });
    }

    @Transactional
    public void revokeAll(UUID userId, PlatformRole role) {
        Instant now = Instant.now();
        sessions.findByUserIdAndRoleOrderByLastSeenAtDesc(userId, role).stream()
                .filter(session -> session.getRevokedAt() == null)
                .forEach(session -> {
                    session.setRevokedAt(now);
                    session.setTrustedDevice(false);
                    session.setTrustedDeviceTokenHash(null);
                });
    }

    private void requireSessionUser(AuthenticatedUser user) {
        if (user == null || user.sessionId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in again to manage account sessions.");
        }
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String fingerprint(String value) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 must be available.", exception);
        }
    }

    private String deviceName(String userAgent) {
        String value = userAgent == null ? "Unknown browser" : userAgent;
        String browser = value.contains("Edg/") ? "Microsoft Edge" : value.contains("Chrome/") ? "Chrome" : value.contains("Firefox/") ? "Firefox" : value.contains("Safari/") ? "Safari" : "Web browser";
        String platform = value.contains("Windows") ? "Windows" : value.contains("Macintosh") ? "macOS" : value.contains("Android") ? "Android" : value.contains("iPhone") || value.contains("iPad") ? "iOS" : "device";
        return browser + " on " + platform;
    }

    private String safeLocationHint(String forwardedFor) {
        return forwardedFor == null || forwardedFor.isBlank() ? "Current network" : "Network " + fingerprint(forwardedFor).substring(0, 8).toUpperCase();
    }

    public record SessionGrant(AuthenticatedUser user, String trustedDeviceToken) { }
    public record SessionView(UUID id, String deviceName, String locationHint, boolean trustedDevice, boolean current,
                              Instant createdAt, Instant lastSeenAt, Instant sessionExpiresAt, Instant trustedUntil) { }
}

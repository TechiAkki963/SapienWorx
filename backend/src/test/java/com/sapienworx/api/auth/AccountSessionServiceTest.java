package com.sapienworx.api.auth;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.JwtTokenService;
import com.sapienworx.api.security.PlatformRole;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountSessionServiceTest {

    @Test
    void createsARevocableTrustedCandidateSessionWithoutStoringTheRawToken() {
        AccountSessionRepository repository = mock(AccountSessionRepository.class);
        JwtTokenService jwt = mock(JwtTokenService.class);
        when(jwt.ttl()).thenReturn(Duration.ofHours(8));
        when(repository.save(any(AccountSession.class))).thenAnswer(call -> call.getArgument(0));
        AccountSessionService service = new AccountSessionService(repository, jwt);
        UUID candidateId = UUID.randomUUID();

        AccountSessionService.SessionGrant grant = service.create(new AuthenticatedUser(candidateId, PlatformRole.CANDIDATE),
                "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0", "127.0.0.1", true);

        var captor = org.mockito.ArgumentCaptor.forClass(AccountSession.class);
        verify(repository).save(captor.capture());
        AccountSession stored = captor.getValue();
        assertThat(grant.user().sessionId()).isEqualTo(stored.getId());
        assertThat(grant.trustedDeviceToken()).isNotBlank();
        assertThat(stored.getTrustedDeviceTokenHash()).hasSize(64).doesNotContain(grant.trustedDeviceToken());
        assertThat(stored.getDeviceName()).isEqualTo("Chrome on Windows");
        assertThat(stored.trustedAt(Instant.now())).isTrue();

        when(repository.findByUserIdAndRoleAndTrustedDeviceTokenHash(candidateId, PlatformRole.CANDIDATE,
                stored.getTrustedDeviceTokenHash())).thenReturn(Optional.of(stored));
        assertThat(service.isTrustedCandidateDevice(candidateId, grant.trustedDeviceToken())).isTrue();
    }

    @Test
    void revokedSessionsStopAuthenticatingImmediately() {
        AccountSessionRepository repository = mock(AccountSessionRepository.class);
        JwtTokenService jwt = mock(JwtTokenService.class);
        AccountSessionService service = new AccountSessionService(repository, jwt);
        UUID sessionId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        AccountSession session = AccountSession.builder().id(sessionId).userId(userId).role(PlatformRole.RECRUITER)
                .deviceName("Browser").createdAt(Instant.now()).lastSeenAt(Instant.now())
                .sessionExpiresAt(Instant.now().plusSeconds(3600)).build();
        when(repository.findById(sessionId)).thenReturn(Optional.of(session));

        assertThat(service.isActive(sessionId, userId, PlatformRole.RECRUITER)).isTrue();
        assertThat(service.revoke(new AuthenticatedUser(userId, PlatformRole.RECRUITER, sessionId), sessionId)).isTrue();
        assertThat(service.isActive(sessionId, userId, PlatformRole.RECRUITER)).isFalse();
    }
}

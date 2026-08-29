package com.sapienworx.api.auth;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.AuthenticationCookieService;
import com.sapienworx.api.security.PlatformRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/account/security")
@RequiredArgsConstructor
public class AccountSecurityController {
    private final AccountSessionService sessions;
    private final CandidateRecoveryCodeService recoveryCodes;
    private final AuthenticationCookieService cookies;

    @GetMapping("/sessions")
    public List<AccountSessionService.SessionView> sessions(@AuthenticationPrincipal AuthenticatedUser user) {
        return sessions.list(user);
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> revoke(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID sessionId) {
        boolean current = sessions.revoke(user, sessionId);
        if (!current) return ResponseEntity.noContent().build();
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookies.clear().toString(), cookies.clearTrustedDevice().toString())
                .build();
    }

    @PostMapping("/sessions/revoke-others")
    public ResponseEntity<Void> revokeOthers(@AuthenticationPrincipal AuthenticatedUser user) {
        sessions.revokeOthers(user);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/recovery-codes")
    public Map<String, Integer> recoveryCodeStatus(@AuthenticationPrincipal AuthenticatedUser user) {
        requireCandidate(user);
        return Map.of("remaining", recoveryCodes.remaining(user.userId()));
    }

    @PostMapping("/recovery-codes")
    public Map<String, Object> generateRecoveryCodes(@AuthenticationPrincipal AuthenticatedUser user) {
        requireCandidate(user);
        List<String> values = recoveryCodes.generate(user.userId());
        return Map.of("codes", values, "remaining", values.size());
    }

    private void requireCandidate(AuthenticatedUser user) {
        if (user == null || user.role() != PlatformRole.CANDIDATE) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN,
                    "Recovery codes are available to candidate accounts.");
        }
    }
}

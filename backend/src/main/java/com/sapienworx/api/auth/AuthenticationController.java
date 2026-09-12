package com.sapienworx.api.auth;

import com.sapienworx.api.security.AuthenticationCookieService;
import com.sapienworx.api.security.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Passwordless authentication endpoints. Email OTP is the only active proof. */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthenticationController {
    private final AuthenticationService authenticationService;
    private final AuthenticationCookieService authenticationCookieService;
    private final AccountSessionService accountSessionService;

    @PostMapping("/request-otp")
    public OtpRequestResponse requestOtp(@Valid @RequestBody OtpRequest request) {
        return authenticationService.requestOtp(request, null);
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<AuthSessionResponse> verifyOtp(@Valid @RequestBody OtpVerificationRequest request, HttpServletRequest httpRequest) {
        return sessionResponse(authenticationService.verifyOtp(request), httpRequest);
    }

    @GetMapping("/csrf")
    public CsrfTokenResponse csrf(CsrfToken csrfToken) {
        return new CsrfTokenResponse(csrfToken.getToken(), csrfToken.getHeaderName());
    }

    @GetMapping("/session")
    public ResponseEntity<CurrentSessionResponse> currentSession(@AuthenticationPrincipal AuthenticatedUser user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(new CurrentSessionResponse(user.userId(), user.role().name()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal AuthenticatedUser user) {
        if (user != null && user.sessionId() != null) accountSessionService.revoke(user, user.sessionId());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE,
                authenticationCookieService.clear().toString(), authenticationCookieService.clearTrustedDevice().toString()).build();
    }

    private ResponseEntity<AuthSessionResponse> sessionResponse(AuthSessionResponse session, HttpServletRequest request) {
        if (!session.authenticated()) return ResponseEntity.ok(session);
        AuthenticatedUser user = authenticationService.authenticatedUser(session.userId(), session.role());
        AccountSessionService.SessionGrant grant = accountSessionService.create(user, request.getHeader("User-Agent"), request.getHeader("X-Forwarded-For"), false);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, authenticationCookieService.issue(grant.user()).toString()).body(session);
    }

    public record CsrfTokenResponse(String token, String headerName) { }
    public record CurrentSessionResponse(UUID userId, String role) { }
}

package com.sapienworx.api.auth;

import com.sapienworx.api.security.AuthenticationCookieService;
import com.sapienworx.api.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthenticationController {
    private final AuthenticationService authenticationService;
    private final AuthenticationCookieService authenticationCookieService;
    private final AccountSessionService accountSessionService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/request-otp")
    public OtpRequestResponse requestOtp(@Valid @RequestBody OtpRequest request, HttpServletRequest httpRequest) {
        return authenticationService.requestOtp(request, cookie(httpRequest, AuthenticationCookieService.TRUSTED_DEVICE_COOKIE).orElse(null));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<AuthSessionResponse> verifyOtp(@Valid @RequestBody OtpVerificationRequest request, HttpServletRequest httpRequest) {
        AuthSessionResponse session = authenticationService.verifyOtp(request);
        return sessionResponse(session, Boolean.TRUE.equals(request.trustDevice()), httpRequest);
    }

    @PostMapping("/verify-recovery-code")
    public ResponseEntity<AuthSessionResponse> verifyRecoveryCode(
            @RequestBody AuthenticationService.RecoveryCodeVerificationRequest request,
            HttpServletRequest httpRequest
    ) {
        AuthSessionResponse session = authenticationService.verifyRecoveryCode(request);
        return sessionResponse(session, Boolean.TRUE.equals(request.trustDevice()), httpRequest);
    }

    @PostMapping("/password-reset/request")
    public PasswordResetService.ResetRequested requestPasswordReset(@RequestBody PasswordResetService.PasswordResetRequest request) {
        return passwordResetService.request(request);
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Void> confirmPasswordReset(@RequestBody PasswordResetService.PasswordResetConfirmation request) {
        passwordResetService.confirm(request);
        return ResponseEntity.noContent().build();
    }

    /**
     * Establishes the readable XSRF-TOKEN cookie used alongside the HttpOnly
     * JWT cookie. The browser never receives the JWT value itself.
     */
    @GetMapping("/csrf")
    public CsrfTokenResponse csrf(CsrfToken csrfToken) {
        return new CsrfTokenResponse(csrfToken.getToken(), csrfToken.getHeaderName());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal AuthenticatedUser user) {
        if (user != null && user.sessionId() != null) accountSessionService.revoke(user, user.sessionId());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, authenticationCookieService.clear().toString(), authenticationCookieService.clearTrustedDevice().toString())
                .build();
    }

    private ResponseEntity<AuthSessionResponse> sessionResponse(AuthSessionResponse session, boolean trustDevice, HttpServletRequest request) {
        if (!session.authenticated()) return ResponseEntity.ok(session);
        AuthenticatedUser user = authenticationService.authenticatedUser(session.userId(), session.role());
        AccountSessionService.SessionGrant grant = accountSessionService.create(user, request.getHeader("User-Agent"),
                request.getHeader("X-Forwarded-For"), trustDevice && session.role() == com.sapienworx.api.security.PlatformRole.CANDIDATE);
        ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, authenticationCookieService.issue(grant.user()).toString());
        if (grant.trustedDeviceToken() != null) {
            response.header(HttpHeaders.SET_COOKIE, authenticationCookieService.trustedDevice(grant.trustedDeviceToken()).toString());
        }
        return response.body(session);
    }

    private Optional<String> cookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return Optional.empty();
        return Arrays.stream(request.getCookies()).filter(value -> name.equals(value.getName())).map(Cookie::getValue).findFirst();
    }

    public record CsrfTokenResponse(String token, String headerName) {
    }
}

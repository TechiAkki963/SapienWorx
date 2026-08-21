package com.sapienworx.api.auth;

import com.sapienworx.api.security.AuthenticationCookieService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthenticationController {
    private final AuthenticationService authenticationService;
    private final AuthenticationCookieService authenticationCookieService;

    @PostMapping("/request-otp")
    public OtpRequestResponse requestOtp(@Valid @RequestBody OtpRequest request) {
        return authenticationService.requestOtp(request);
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<AuthSessionResponse> verifyOtp(@Valid @RequestBody OtpVerificationRequest request) {
        AuthSessionResponse session = authenticationService.verifyOtp(request);
        if (!session.authenticated()) return ResponseEntity.ok(session);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, authenticationCookieService.issue(
                        authenticationService.authenticatedUser(session.userId(), session.role())
                ).toString())
                .body(session);
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
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, authenticationCookieService.clear().toString())
                .build();
    }

    public record CsrfTokenResponse(String token, String headerName) {
    }
}

package com.sapienworx.api.auth;

import com.sapienworx.api.security.AuthenticationCookieService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
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

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, authenticationCookieService.clear().toString())
                .build();
    }
}

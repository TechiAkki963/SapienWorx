package com.sapienworx.api.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

/** Creates the JWT cookie only after the OTP flow has completed successfully. */
@Service
public class AuthenticationCookieService {

    private final JwtTokenService jwtTokenService;
    private final boolean secureCookie;

    public AuthenticationCookieService(
            JwtTokenService jwtTokenService,
            @Value("${app.security.cookie.secure:true}") boolean secureCookie
    ) {
        this.jwtTokenService = jwtTokenService;
        this.secureCookie = secureCookie;
    }

    public ResponseCookie issue(AuthenticatedUser user) {
        return ResponseCookie.from(JwtAuthenticationFilter.AUTH_COOKIE, jwtTokenService.issue(user))
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/")
                .maxAge(jwtTokenService.ttl())
                .build();
    }

    public ResponseCookie clear() {
        return ResponseCookie.from(JwtAuthenticationFilter.AUTH_COOKIE, "")
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();
    }
}

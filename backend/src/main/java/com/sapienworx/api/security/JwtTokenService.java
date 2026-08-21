package com.sapienworx.api.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

@Service
public class JwtTokenService {

    private final SecretKey signingKey;
    private final Duration ttl;

    public JwtTokenService(
            @Value("${app.security.jwt.base64-secret}") String base64Secret,
            @Value("${app.security.jwt.ttl:PT8H}") Duration ttl
    ) {
        byte[] keyBytes = Decoders.BASE64.decode(base64Secret);
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException("JWT HMAC secret must contain at least 256 bits.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.ttl = ttl;
    }

    public String issue(AuthenticatedUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.userId().toString())
                .claim("role", user.role().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(signingKey)
                .compact();
    }

    public Optional<AuthenticatedUser> verify(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.of(new AuthenticatedUser(
                    UUID.fromString(claims.getSubject()),
                    PlatformRole.valueOf(claims.get("role", String.class))
            ));
        } catch (RuntimeException invalidToken) {
            return Optional.empty();
        }
    }

    public Duration ttl() {
        return ttl;
    }
}

package com.sapienworx.api.security;

import java.util.UUID;

public record AuthenticatedUser(UUID userId, PlatformRole role, UUID sessionId) {
    public AuthenticatedUser(UUID userId, PlatformRole role) {
        this(userId, role, null);
    }

    public AuthenticatedUser withSession(UUID value) {
        return new AuthenticatedUser(userId, role, value);
    }
}

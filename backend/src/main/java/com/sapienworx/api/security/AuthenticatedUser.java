package com.sapienworx.api.security;

import java.util.UUID;

public record AuthenticatedUser(UUID userId, PlatformRole role) { }

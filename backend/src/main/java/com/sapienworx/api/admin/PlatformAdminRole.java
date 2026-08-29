package com.sapienworx.api.admin;

import java.util.List;

public enum PlatformAdminRole {
    OWNER(List.of("*")),
    OPERATIONS(List.of("platform.read", "operations.manage", "releases.manage", "integrations.manage", "knowledge.manage")),
    SUPPORT(List.of("platform.read", "support.manage", "support.request_access")),
    COMPLIANCE(List.of("platform.read", "privacy.manage", "audit.export", "moderation.manage")),
    FINANCE(List.of("platform.read", "billing.manage", "reports.export")),
    READ_ONLY(List.of("platform.read"));

    private final List<String> permissions;

    PlatformAdminRole(List<String> permissions) {
        this.permissions = permissions;
    }

    public List<String> permissions() {
        return permissions;
    }
}

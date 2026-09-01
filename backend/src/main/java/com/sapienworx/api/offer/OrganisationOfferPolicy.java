package com.sapienworx.api.offer;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrganisationOfferPolicy {
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public OfferResponses.Entitlement entitlement(UUID organisationId) {
        List<Map<String, Object>> rows = jdbc.queryForList("select plan_name, invoice_status from organisation_billing_plans where organisation_id = ?", organisationId);
        if (rows.isEmpty()) return entitlementFor("STARTER");
        return entitlementFor(String.valueOf(rows.get(0).get("plan_name")));
    }

    @Transactional(readOnly = true)
    public void requireActive(UUID organisationId) {
        List<Map<String, Object>> rows = jdbc.queryForList("select invoice_status from organisation_billing_plans where organisation_id = ?", organisationId);
        if (rows.isEmpty()) return;
        String invoice = String.valueOf(rows.get(0).get("invoice_status"));
        if ("PAST_DUE".equals(invoice) || "SUSPENDED".equals(invoice)) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                    "Offer Management is paused while this organisation's billing status requires attention.");
        }
    }

    private OfferResponses.Entitlement entitlementFor(String rawPlan) {
        String plan = rawPlan == null ? "STARTER" : rawPlan.toUpperCase(java.util.Locale.ROOT);
        return switch (plan) {
            case "ENTERPRISE" -> new OfferResponses.Entitlement(plan, 12, true, true, true);
            case "BUSINESS" -> new OfferResponses.Entitlement(plan, 8, true, true, true);
            case "GROWTH" -> new OfferResponses.Entitlement(plan, 3, true, false, false);
            default -> new OfferResponses.Entitlement("STARTER", 1, false, false, false);
        };
    }
}

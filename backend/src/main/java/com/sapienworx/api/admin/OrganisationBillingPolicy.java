package com.sapienworx.api.admin;

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
public class OrganisationBillingPolicy {
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public void requireJobCredit(UUID organisationId) {
        List<Map<String, Object>> plans = jdbc.queryForList("""
                select monthly_job_credit_limit, invoice_status from organisation_billing_plans
                where organisation_id = ?
                """, organisationId);
        if (plans.isEmpty()) return;
        Map<String, Object> plan = plans.get(0);
        String invoiceStatus = String.valueOf(plan.get("invoice_status"));
        if (invoiceStatus.equals("SUSPENDED") || invoiceStatus.equals("PAST_DUE")) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "This organisation's billing status requires attention before another job can be created.");
        }
        int limit = ((Number) plan.get("monthly_job_credit_limit")).intValue();
        if (limit == 0) return;
        Long used = jdbc.queryForObject("""
                select count(*) from jobs where organisation_id = ? and created_at >= date_trunc('month', now())
                """, Long.class, organisationId);
        if (used != null && used >= limit) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This organisation has used its monthly job credits.");
        }
    }
}

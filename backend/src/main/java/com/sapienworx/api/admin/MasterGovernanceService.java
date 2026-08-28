package com.sapienworx.api.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.organisation.OrganisationRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MasterGovernanceService {
    private static final Set<String> APPROVAL_STATUSES = Set.of("APPROVED", "REJECTED");
    private static final Set<String> ALERT_STATUSES = Set.of("OPEN", "ACKNOWLEDGED", "RESOLVED");
    private static final Set<String> MODERATION_STATUSES = Set.of("OPEN", "REVIEWING", "ACTIONED", "DISMISSED");
    private static final Set<String> INTEGRATION_STATUSES = Set.of("NOT_CONFIGURED", "CONFIGURED", "HEALTHY", "DEGRADED", "DISABLED");
    private static final Set<String> PLAN_NAMES = Set.of("STARTER", "GROWTH", "BUSINESS", "ENTERPRISE");
    private static final Set<String> INVOICE_STATUSES = Set.of("TRIAL", "CURRENT", "PAST_DUE", "SUSPENDED");
    private static final Set<String> SUPPORT_ACCESS_STATUSES = Set.of("APPROVED", "ACTIVE", "REJECTED", "ENDED");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final PlatformAdministratorRepository administrators;
    private final CandidateRepository candidates;
    private final RecruiterRepository recruiters;
    private final OrganisationRepository organisations;
    private final JobRepository jobs;
    private final JobApplicationRepository applications;
    private final PlatformQueueMonitor queueMonitor;

    @Transactional
    public Map<String, Object> summary(UUID actor) {
        requireAdministrator(actor);
        refreshBillingPlans();
        refreshModerationCases();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("currentAdmin", adminView(requireAdministrator(actor)));
        result.put("admins", administrators.findAll().stream().map(this::adminView).toList());
        result.put("approvals", approvals());
        result.put("alerts", alerts());
        result.put("securityPolicy", securityPolicy());
        result.put("moderationCases", moderationCases());
        result.put("featureFlags", featureFlags());
        result.put("integrations", integrations());
        result.put("billingPlans", billingPlans());
        result.put("supportAccess", supportAccess());
        result.put("business", businessAnalytics());
        return result;
    }

    @Transactional
    @AuditAction(action = "MASTER_ADMIN_ROLE_UPDATED", resourceType = "PLATFORM_ADMIN", resourceIdArgumentIndex = 1)
    public Map<String, Object> updateAdminRole(UUID actor, UUID administratorId, MasterGovernanceRequests.AdminRoleUpdate request) {
        requireRole(actor, PlatformAdminRole.OWNER);
        if (request.role() == null) throw invalid("Choose an administrator role.");
        if (actor.equals(administratorId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Use another Owner to review changes to your own access.");
        Integer approved = jdbc.queryForObject("""
                select count(*) from platform_approval_requests
                where request_kind = 'ADMIN_ROLE_CHANGE' and resource_id = ? and status = 'APPROVED'
                  and payload_json ->> 'role' = ? and expires_at > now()
                """, Integer.class, administratorId.toString(), request.role().name());
        if (approved == null || approved == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "An approved, unexpired role-change request is required.");
        PlatformAdministrator administrator = administrators.findById(administratorId)
                .orElseThrow(() -> notFound("Administrator was not found."));
        administrator.setAdminRole(request.role());
        return adminView(administrators.save(administrator));
    }

    @Transactional
    @AuditAction(action = "MASTER_APPROVAL_REQUESTED", resourceType = "APPROVAL")
    public Map<String, Object> createApproval(UUID actor, MasterGovernanceRequests.ApprovalCreate request) {
        requireMutatingRole(actor);
        if (blank(request.requestKind()) || blank(request.resourceType()) || blank(request.summary())) {
            throw invalid("Approval type, resource, and summary are required.");
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into platform_approval_requests
                    (id, request_kind, resource_type, resource_id, summary, payload_json, requested_by)
                values (?, ?, ?, ?, ?, cast(? as jsonb), ?)
                """, id, normalized(request.requestKind()).toUpperCase(Locale.ROOT), normalized(request.resourceType()).toUpperCase(Locale.ROOT),
                trimToNull(request.resourceId()), normalized(request.summary()), json(request.payload()), actor);
        return approval(id);
    }

    @Transactional
    @AuditAction(action = "MASTER_APPROVAL_DECIDED", resourceType = "APPROVAL", resourceIdArgumentIndex = 1)
    public Map<String, Object> decideApproval(UUID actor, UUID approvalId, MasterGovernanceRequests.ApprovalDecision request) {
        requireRole(actor, PlatformAdminRole.OWNER, PlatformAdminRole.COMPLIANCE);
        String status = upper(request.status());
        if (!APPROVAL_STATUSES.contains(status)) throw invalid("Choose Approved or Rejected.");
        Map<String, Object> current = jdbc.queryForMap("select requested_by, status from platform_approval_requests where id = ?", approvalId);
        if (actor.equals(current.get("requested_by"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "The requester cannot approve their own action.");
        if (!"PENDING".equals(String.valueOf(current.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "This approval has already been decided.");
        jdbc.update("""
                update platform_approval_requests set status = ?, decided_by = ?, decision_note = ?, decided_at = now()
                where id = ?
                """, status, actor, trimToNull(request.note()), approvalId);
        return approval(approvalId);
    }

    @Transactional
    @AuditAction(action = "MASTER_ALERT_UPDATED", resourceType = "PLATFORM_ALERT")
    public Map<String, Object> updateAlert(UUID actor, String alertKey, MasterGovernanceRequests.AlertUpdate request) {
        requireRole(actor, PlatformAdminRole.OWNER, PlatformAdminRole.OPERATIONS, PlatformAdminRole.COMPLIANCE);
        String status = upper(request.status());
        if (!ALERT_STATUSES.contains(status)) throw invalid("Choose a valid alert status.");
        jdbc.update("""
                insert into platform_alert_states (alert_key, status, note, updated_by)
                values (?, ?, ?, ?)
                on conflict (alert_key) do update set status = excluded.status, note = excluded.note,
                    updated_by = excluded.updated_by, updated_at = now()
                """, normalized(alertKey), status, trimToNull(request.note()), actor);
        return alerts().stream().filter(alert -> alertKey.equals(alert.get("key"))).findFirst()
                .orElseGet(() -> map("key", alertKey, "status", status, "note", value(request.note())));
    }

    @Transactional
    @AuditAction(action = "MASTER_SECURITY_POLICY_UPDATED", resourceType = "SECURITY_POLICY")
    public Map<String, Object> updateSecurityPolicy(UUID actor, MasterGovernanceRequests.SecurityPolicyUpdate request) {
        requireRole(actor, PlatformAdminRole.OWNER);
        Map<String, Object> current = securityPolicy();
        boolean adminMfa = booleanValue(request.adminMfaRequired(), current.get("adminMfaRequired"));
        boolean suspicious = booleanValue(request.suspiciousLoginDetectionEnabled(), current.get("suspiciousLoginDetectionEnabled"));
        boolean allowlist = booleanValue(request.ipAllowlistEnabled(), current.get("ipAllowlistEnabled"));
        boolean consent = booleanValue(request.supportAccessRequiresConsent(), current.get("supportAccessRequiresConsent"));
        int passwordLength = bounded(request.minimumPasswordLength(), current.get("minimumPasswordLength"), 8, 128);
        int sessionMinutes = bounded(request.sessionDurationMinutes(), current.get("sessionDurationMinutes"), 15, 10080);
        int failedAttempts = bounded(request.maximumFailedAttempts(), current.get("maximumFailedAttempts"), 3, 20);
        String ranges = request.allowedIpRanges() == null ? String.valueOf(current.get("allowedIpRanges")) : normalized(request.allowedIpRanges());
        if (allowlist && blank(ranges)) throw invalid("Add at least one approved IP address or CIDR range before enabling the allowlist.");
        jdbc.update("""
                update platform_security_policy set admin_mfa_required = ?, suspicious_login_detection_enabled = ?,
                    ip_allowlist_enabled = ?, allowed_ip_ranges = ?, minimum_password_length = ?,
                    session_duration_minutes = ?, maximum_failed_attempts = ?, support_access_requires_consent = ?,
                    updated_by = ?, updated_at = now() where id = true
                """, adminMfa, suspicious, allowlist, trimToNull(ranges), passwordLength, sessionMinutes, failedAttempts, consent, actor);
        return securityPolicy();
    }

    @Transactional
    @AuditAction(action = "MASTER_MODERATION_CASE_UPDATED", resourceType = "MODERATION_CASE", resourceIdArgumentIndex = 1)
    public Map<String, Object> updateModeration(UUID actor, UUID caseId, MasterGovernanceRequests.ModerationUpdate request) {
        requireRole(actor, PlatformAdminRole.OWNER, PlatformAdminRole.COMPLIANCE, PlatformAdminRole.OPERATIONS);
        String status = upper(request.status());
        if (!MODERATION_STATUSES.contains(status)) throw invalid("Choose a valid moderation status.");
        int changed = jdbc.update("""
                update platform_moderation_cases set status = ?, owner_admin_id = coalesce(?, owner_admin_id),
                    resolution_note = ?, updated_at = now() where id = ?
                """, status, request.ownerAdminId() == null ? actor : request.ownerAdminId(), trimToNull(request.resolutionNote()), caseId);
        if (changed == 0) throw notFound("Moderation case was not found.");
        return moderationCase(caseId);
    }

    @Transactional
    @AuditAction(action = "MASTER_FEATURE_FLAG_UPDATED", resourceType = "FEATURE_FLAG")
    public Map<String, Object> updateFeatureFlag(UUID actor, String flagKey, MasterGovernanceRequests.FeatureFlagUpdate request) {
        requireRole(actor, PlatformAdminRole.OWNER, PlatformAdminRole.OPERATIONS);
        Map<String, Object> current = jdbc.queryForMap("select * from platform_feature_flags where flag_key = ?", flagKey);
        boolean enabled = booleanValue(request.enabled(), current.get("enabled"));
        int rollout = bounded(request.rolloutPercent(), current.get("rollout_percent"), 0, 100);
        jdbc.update("""
                update platform_feature_flags set enabled = ?, rollout_percent = ?, organisation_id = ?, scheduled_at = ?,
                    updated_by = ?, updated_at = now() where flag_key = ?
                """, enabled, rollout, request.organisationId(), request.scheduledAt(), actor, flagKey);
        return featureFlags().stream().filter(flag -> flagKey.equals(flag.get("key"))).findFirst()
                .orElseThrow(() -> notFound("Feature flag was not found."));
    }

    @Transactional
    @AuditAction(action = "MASTER_INTEGRATION_UPDATED", resourceType = "INTEGRATION", resourceIdArgumentIndex = 1)
    public Map<String, Object> updateIntegration(UUID actor, UUID integrationId, MasterGovernanceRequests.IntegrationUpdate request) {
        requireRole(actor, PlatformAdminRole.OWNER, PlatformAdminRole.OPERATIONS);
        String status = upper(request.status());
        if (!INTEGRATION_STATUSES.contains(status)) throw invalid("Choose a valid integration status.");
        String secretReference = trimToNull(request.secretReference());
        if (secretReference != null && !(secretReference.startsWith("vault://") || secretReference.startsWith("env://") || secretReference.startsWith("secret://"))) {
            throw invalid("Store credentials in a secret manager and provide only a vault://, env://, or secret:// reference.");
        }
        int changed = jdbc.update("""
                update platform_integrations set status = ?, endpoint = ?, secret_reference = ?, last_checked_at = now(),
                    last_error = null, updated_by = ?, updated_at = now() where id = ?
                """, status, trimToNull(request.endpoint()), secretReference, actor, integrationId);
        if (changed == 0) throw notFound("Integration was not found.");
        return integration(integrationId);
    }

    @Transactional
    @AuditAction(action = "MASTER_BILLING_PLAN_UPDATED", resourceType = "ORGANISATION", resourceIdArgumentIndex = 1)
    public Map<String, Object> updateBilling(UUID actor, UUID organisationId, MasterGovernanceRequests.BillingUpdate request) {
        requireRole(actor, PlatformAdminRole.OWNER, PlatformAdminRole.FINANCE);
        if (!organisations.existsById(organisationId)) throw notFound("Organisation was not found.");
        String plan = upper(request.planName());
        String invoice = upper(request.invoiceStatus());
        if (!PLAN_NAMES.contains(plan) || !INVOICE_STATUSES.contains(invoice)) throw invalid("Choose a valid plan and invoice status.");
        int seats = bounded(request.recruiterSeatLimit(), 5, 1, 100000);
        int credits = bounded(request.monthlyJobCreditLimit(), 10, 0, 1000000);
        jdbc.update("""
                insert into organisation_billing_plans
                    (organisation_id, plan_name, recruiter_seat_limit, monthly_job_credit_limit, invoice_status, renewal_at, updated_by)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict (organisation_id) do update set plan_name = excluded.plan_name,
                    recruiter_seat_limit = excluded.recruiter_seat_limit,
                    monthly_job_credit_limit = excluded.monthly_job_credit_limit,
                    invoice_status = excluded.invoice_status, renewal_at = excluded.renewal_at,
                    updated_by = excluded.updated_by, updated_at = now()
                """, organisationId, plan, seats, credits, invoice, request.renewalAt(), actor);
        return billingPlans().stream().filter(item -> organisationId.toString().equals(item.get("organisationId"))).findFirst()
                .orElseThrow(() -> notFound("Billing plan was not found."));
    }

    @Transactional
    @AuditAction(action = "MASTER_SUPPORT_ACCESS_REQUESTED", resourceType = "SUPPORT_ACCESS")
    public Map<String, Object> requestSupportAccess(UUID actor, MasterGovernanceRequests.SupportAccessCreate request) {
        requireRole(actor, PlatformAdminRole.OWNER, PlatformAdminRole.SUPPORT);
        if (request.subjectType() == null || request.subjectId() == null || blank(request.subjectLabel()) || blank(request.purpose())) {
            throw invalid("Subject, purpose, and subject label are required.");
        }
        subjectExists(request.subjectType(), request.subjectId());
        if ((boolean) securityPolicy().get("supportAccessRequiresConsent") && blank(request.consentReference())) {
            throw invalid("Record the consent or support-ticket reference before requesting support access.");
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into platform_support_access_requests
                    (id, subject_type, subject_id, subject_label, purpose, consent_reference, requested_by)
                values (?, ?, ?, ?, ?, ?, ?)
                """, id, request.subjectType().name(), request.subjectId(), normalized(request.subjectLabel()),
                normalized(request.purpose()), trimToNull(request.consentReference()), actor);
        return supportAccess(id);
    }

    @Transactional
    @AuditAction(action = "MASTER_SUPPORT_ACCESS_UPDATED", resourceType = "SUPPORT_ACCESS", resourceIdArgumentIndex = 1)
    public Map<String, Object> updateSupportAccess(UUID actor, UUID requestId, MasterGovernanceRequests.SupportAccessUpdate request) {
        requireRole(actor, PlatformAdminRole.OWNER, PlatformAdminRole.SUPPORT, PlatformAdminRole.COMPLIANCE);
        String status = upper(request.status());
        if (!SUPPORT_ACCESS_STATUSES.contains(status)) throw invalid("Choose a valid support-access status.");
        Map<String, Object> current = jdbc.queryForMap("select requested_by, status, consent_reference from platform_support_access_requests where id = ?", requestId);
        String currentStatus = String.valueOf(current.get("status"));
        if ((status.equals("APPROVED") || status.equals("REJECTED")) && actor.equals(current.get("requested_by"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The requester cannot approve their own support access.");
        }
        if (status.equals("ACTIVE") && !"APPROVED".equals(currentStatus)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Support access must be approved before it can be activated.");
        if (status.equals("APPROVED") && blank(String.valueOf(current.get("consent_reference")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "A consent reference is required before approval.");
        if (status.equals("APPROVED")) {
            jdbc.update("update platform_support_access_requests set status = 'APPROVED', approved_by = ?, approved_at = now(), expires_at = now() + interval '30 minutes' where id = ?", actor, requestId);
        } else if (status.equals("ACTIVE")) {
            jdbc.update("update platform_support_access_requests set status = 'ACTIVE' where id = ? and expires_at > now()", requestId);
        } else if (status.equals("ENDED")) {
            jdbc.update("update platform_support_access_requests set status = 'ENDED', ended_at = now() where id = ?", requestId);
        } else {
            jdbc.update("update platform_support_access_requests set status = 'REJECTED', approved_by = ?, approved_at = now(), ended_at = now() where id = ?", actor, requestId);
        }
        return supportAccess(requestId);
    }

    @Transactional(readOnly = true)
    @AuditAction(action = "MASTER_MASKED_SUPPORT_SNAPSHOT_VIEWED", resourceType = "SUPPORT_ACCESS", resourceIdArgumentIndex = 1)
    public Map<String, Object> maskedSupportSnapshot(UUID actor, UUID requestId) {
        requireRole(actor, PlatformAdminRole.OWNER, PlatformAdminRole.SUPPORT, PlatformAdminRole.COMPLIANCE);
        Map<String, Object> access = supportAccess(requestId);
        if (!"ACTIVE".equals(access.get("status")) || Boolean.FALSE.equals(access.get("unexpired"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This support access is not active or has expired.");
        }
        PlatformSubjectType type = PlatformSubjectType.valueOf(String.valueOf(access.get("subjectType")));
        UUID subjectId = UUID.fromString(String.valueOf(access.get("subjectId")));
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("subjectType", type.name());
        snapshot.put("subjectId", subjectId.toString());
        snapshot.put("masked", true);
        if (type == PlatformSubjectType.CANDIDATE) {
            Candidate candidate = candidates.findById(subjectId).orElseThrow(() -> notFound("Candidate was not found."));
            snapshot.put("name", candidate.getFullName());
            snapshot.put("email", maskEmail(candidate.getEmail()));
            snapshot.put("mobile", maskMobile(candidate.getMobile()));
            snapshot.put("profileStatus", candidate.getRegistrationStatus().name());
            snapshot.put("profileSearchable", candidate.isProfileSearchable());
            snapshot.put("lastActiveAt", value(candidate.getLastActiveAt()));
        } else if (type == PlatformSubjectType.RECRUITER) {
            Recruiter recruiter = recruiters.findById(subjectId).orElseThrow(() -> notFound("Recruiter was not found."));
            snapshot.put("name", recruiter.getFullName());
            snapshot.put("email", maskEmail(recruiter.getOfficialEmail()));
            snapshot.put("mobile", maskMobile(recruiter.getMobile()));
            snapshot.put("organisation", recruiter.getOrganisation().getName());
            snapshot.put("verified", recruiter.isEmailVerified());
        } else {
            Organisation organisation = organisations.findById(subjectId).orElseThrow(() -> notFound("Organisation was not found."));
            snapshot.put("name", organisation.getName());
            snapshot.put("recruiters", recruiters.findByOrganisation_Id(subjectId).size());
            snapshot.put("jobs", jobs.findByOrganisation_IdOrderByUpdatedAtDesc(subjectId, org.springframework.data.domain.PageRequest.of(0, 1)).getTotalElements());
        }
        snapshot.put("expiresAt", access.get("expiresAt"));
        return snapshot;
    }

    @Transactional(readOnly = true)
    public String operationalReportCsv(UUID actor) {
        requireAdministrator(actor);
        Map<String, Object> business = businessAnalytics();
        StringBuilder csv = new StringBuilder("metric,value\n");
        for (Map.Entry<String, Object> entry : business.entrySet()) {
            csv.append(csv(entry.getKey())).append(',').append(csv(String.valueOf(entry.getValue()))).append('\n');
        }
        csv.append("Open alerts,").append(alerts().stream().filter(alert -> !"RESOLVED".equals(alert.get("status"))).count()).append('\n');
        csv.append("Pending approvals,").append(approvals().stream().filter(item -> "PENDING".equals(item.get("status"))).count()).append('\n');
        csv.append("Open moderation cases,").append(moderationCases().stream().filter(item -> "OPEN".equals(item.get("status"))).count()).append('\n');
        return csv.toString();
    }

    private void refreshBillingPlans() {
        jdbc.update("""
                insert into organisation_billing_plans (organisation_id)
                select id from organisations on conflict (organisation_id) do nothing
                """);
    }

    private void refreshModerationCases() {
        for (Candidate candidate : candidates.findAll()) {
            List<String> missing = new ArrayList<>();
            if (blank(candidate.getHeadline())) missing.add("headline");
            if (blank(candidate.getLocation())) missing.add("location");
            if (candidate.getOverallExperienceYears() == null) missing.add("experience");
            if (!missing.isEmpty()) insertModeration("INCOMPLETE_PROFILE", PlatformSubjectType.CANDIDATE, candidate.getId(), candidate.getFullName(),
                    "Profile is missing " + String.join(", ", missing) + ".", Math.min(80, 20 + missing.size() * 15));
        }
        Instant staleAt = Instant.now().minus(30, ChronoUnit.DAYS);
        for (Job job : jobs.findAll()) {
            if (job.getStatus() == JobStatus.ACTIVE && job.getUpdatedAt().isBefore(staleAt)) {
                insertModeration("STALE_JOB", PlatformSubjectType.ORGANISATION, job.getOrganisation().getId(), job.getTitle(),
                        "Active job has not been updated in more than 30 days.", 45);
            }
        }
    }

    private void insertModeration(String caseType, PlatformSubjectType subjectType, UUID subjectId, String label, String reason, int risk) {
        jdbc.update("""
                insert into platform_moderation_cases
                    (id, case_type, subject_type, subject_id, subject_label, reason, risk_score)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict (case_type, subject_type, subject_id) do nothing
                """, UUID.randomUUID(), caseType, subjectType.name(), subjectId, normalized(label), reason, risk);
    }

    private List<Map<String, Object>> approvals() {
        return jdbc.query("""
                select approval.*, approval.payload_json ->> 'role' requested_role,
                       requester.display_name requester_name, reviewer.display_name reviewer_name
                from platform_approval_requests approval
                join platform_administrators requester on requester.id = approval.requested_by
                left join platform_administrators reviewer on reviewer.id = approval.decided_by
                order by approval.requested_at desc limit 100
                """, (rs, row) -> map(
                "id", rs.getString("id"), "requestKind", rs.getString("request_kind"), "resourceType", rs.getString("resource_type"),
                "resourceId", value(rs.getString("resource_id")), "summary", rs.getString("summary"), "status", rs.getString("status"),
                "requestedRole", value(rs.getString("requested_role")),
                "requestedBy", rs.getString("requester_name"), "decidedBy", value(rs.getString("reviewer_name")),
                "decisionNote", value(rs.getString("decision_note")), "requestedAt", value(rs.getObject("requested_at")),
                "expiresAt", value(rs.getObject("expires_at"))));
    }

    private Map<String, Object> approval(UUID id) {
        return approvals().stream().filter(item -> id.toString().equals(item.get("id"))).findFirst().orElseThrow(() -> notFound("Approval was not found."));
    }

    private List<Map<String, Object>> alerts() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> queue : queueMonitor.queues()) {
            boolean available = Boolean.TRUE.equals(queue.get("available"));
            long messages = ((Number) queue.get("messages")).longValue();
            String name = String.valueOf(queue.get("name"));
            if (!available) result.add(alert("queue-unavailable-" + name, "CRITICAL", "Queue unavailable", queue.get("label") + " cannot be reached.", "RabbitMQ"));
            else if ("DEAD_LETTER".equals(queue.get("group")) && messages > 0) result.add(alert("dlq-" + name, "HIGH", "Dead-letter messages need review", messages + " messages are waiting in " + name + ".", "RabbitMQ"));
            else if (messages > 100) result.add(alert("queue-backlog-" + name, "MEDIUM", "Queue backlog is growing", messages + " messages are waiting in " + name + ".", "RabbitMQ"));
        }
        long urgentTickets = count("select count(*) from platform_support_tickets where status <> 'RESOLVED' and priority in ('HIGH', 'URGENT')");
        if (urgentTickets > 0) result.add(alert("urgent-support", "HIGH", "High-priority support cases", urgentTickets + " high-priority cases are unresolved.", "Support"));
        long overduePrivacy = count("select count(*) from platform_privacy_cases where status not in ('COMPLETED', 'DECLINED') and due_at < now()");
        if (overduePrivacy > 0) result.add(alert("privacy-overdue", "CRITICAL", "Privacy requests are overdue", overduePrivacy + " privacy cases passed their response deadline.", "Compliance"));
        long incompleteProfiles = count("select count(*) from candidates where headline is null or location is null or overall_experience_years is null");
        if (incompleteProfiles > 0) result.add(alert("candidate-profile-quality", "LOW", "Candidate profile quality", incompleteProfiles + " candidate profiles are missing core sourcing details.", "Data quality"));
        long pastDue = count("select count(*) from organisation_billing_plans where invoice_status in ('PAST_DUE', 'SUSPENDED')");
        if (pastDue > 0) result.add(alert("billing-past-due", "HIGH", "Billing attention required", pastDue + " organisations have past-due or suspended billing.", "Billing"));
        return result;
    }

    private Map<String, Object> alert(String key, String severity, String title, String description, String source) {
        List<Map<String, Object>> state = jdbc.queryForList("select status, note, updated_at from platform_alert_states where alert_key = ?", key);
        String status = state.isEmpty() ? "OPEN" : String.valueOf(state.get(0).get("status"));
        return map("key", key, "severity", severity, "title", title, "description", description, "source", source,
                "status", status, "note", state.isEmpty() ? "" : value(state.get(0).get("note")),
                "updatedAt", state.isEmpty() ? "" : value(state.get(0).get("updated_at")));
    }

    private Map<String, Object> securityPolicy() {
        return jdbc.queryForObject("select * from platform_security_policy where id = true", (rs, row) -> map(
                "adminMfaRequired", rs.getBoolean("admin_mfa_required"),
                "suspiciousLoginDetectionEnabled", rs.getBoolean("suspicious_login_detection_enabled"),
                "ipAllowlistEnabled", rs.getBoolean("ip_allowlist_enabled"),
                "allowedIpRanges", value(rs.getString("allowed_ip_ranges")),
                "minimumPasswordLength", rs.getInt("minimum_password_length"),
                "sessionDurationMinutes", rs.getInt("session_duration_minutes"),
                "maximumFailedAttempts", rs.getInt("maximum_failed_attempts"),
                "supportAccessRequiresConsent", rs.getBoolean("support_access_requires_consent"),
                "updatedAt", value(rs.getObject("updated_at"))));
    }

    private List<Map<String, Object>> moderationCases() {
        return jdbc.query("select * from platform_moderation_cases order by risk_score desc, updated_at desc limit 100", (rs, row) -> map(
                "id", rs.getString("id"), "caseType", rs.getString("case_type"), "subjectType", rs.getString("subject_type"),
                "subjectId", rs.getString("subject_id"), "subjectLabel", rs.getString("subject_label"), "reason", rs.getString("reason"),
                "riskScore", rs.getInt("risk_score"), "status", rs.getString("status"),
                "resolutionNote", value(rs.getString("resolution_note")), "updatedAt", value(rs.getObject("updated_at"))));
    }

    private Map<String, Object> moderationCase(UUID id) {
        return moderationCases().stream().filter(item -> id.toString().equals(item.get("id"))).findFirst().orElseThrow(() -> notFound("Moderation case was not found."));
    }

    private List<Map<String, Object>> featureFlags() {
        return jdbc.query("""
                select flag.*, organisation.name organisation_name from platform_feature_flags flag
                left join organisations organisation on organisation.id = flag.organisation_id
                order by flag.label
                """, (rs, row) -> map("key", rs.getString("flag_key"), "label", rs.getString("label"), "description", rs.getString("description"),
                "enabled", rs.getBoolean("enabled"), "rolloutPercent", rs.getInt("rollout_percent"),
                "organisationId", value(rs.getString("organisation_id")), "organisation", value(rs.getString("organisation_name")),
                "scheduledAt", value(rs.getObject("scheduled_at")), "updatedAt", value(rs.getObject("updated_at"))));
    }

    private List<Map<String, Object>> integrations() {
        return jdbc.query("select * from platform_integrations order by integration_name", (rs, row) -> map(
                "id", rs.getString("id"), "name", rs.getString("integration_name"), "kind", rs.getString("integration_kind"),
                "status", rs.getString("status"), "endpoint", value(rs.getString("endpoint")),
                "secretReference", value(rs.getString("secret_reference")), "lastCheckedAt", value(rs.getObject("last_checked_at")),
                "lastError", value(rs.getString("last_error"))));
    }

    private Map<String, Object> integration(UUID id) {
        return integrations().stream().filter(item -> id.toString().equals(item.get("id"))).findFirst().orElseThrow(() -> notFound("Integration was not found."));
    }

    private List<Map<String, Object>> billingPlans() {
        return jdbc.query("""
                select billing.*, organisation.name organisation_name,
                       (select count(*) from recruiters recruiter where recruiter.organisation_id = organisation.id) seats_used,
                       (select count(*) from jobs job where job.organisation_id = organisation.id and job.created_at >= date_trunc('month', now())) jobs_this_month
                from organisation_billing_plans billing
                join organisations organisation on organisation.id = billing.organisation_id
                order by organisation.name
                """, (rs, row) -> map("organisationId", rs.getString("organisation_id"), "organisation", rs.getString("organisation_name"),
                "planName", rs.getString("plan_name"), "recruiterSeatLimit", rs.getInt("recruiter_seat_limit"),
                "seatsUsed", rs.getLong("seats_used"), "monthlyJobCreditLimit", rs.getInt("monthly_job_credit_limit"),
                "jobsThisMonth", rs.getLong("jobs_this_month"), "invoiceStatus", rs.getString("invoice_status"),
                "renewalAt", value(rs.getObject("renewal_at")), "updatedAt", value(rs.getObject("updated_at"))));
    }

    private List<Map<String, Object>> supportAccess() {
        return jdbc.query("""
                select access.*, requester.display_name requester_name, approver.display_name approver_name,
                       (access.expires_at is null or access.expires_at > now()) unexpired
                from platform_support_access_requests access
                join platform_administrators requester on requester.id = access.requested_by
                left join platform_administrators approver on approver.id = access.approved_by
                order by access.created_at desc limit 100
                """, (rs, row) -> map("id", rs.getString("id"), "subjectType", rs.getString("subject_type"),
                "subjectId", rs.getString("subject_id"), "subjectLabel", rs.getString("subject_label"),
                "purpose", rs.getString("purpose"), "consentReference", value(rs.getString("consent_reference")),
                "status", rs.getString("status"), "requestedBy", rs.getString("requester_name"),
                "approvedBy", value(rs.getString("approver_name")), "createdAt", value(rs.getObject("created_at")),
                "expiresAt", value(rs.getObject("expires_at")), "unexpired", rs.getBoolean("unexpired")));
    }

    private Map<String, Object> supportAccess(UUID id) {
        return supportAccess().stream().filter(item -> id.toString().equals(item.get("id"))).findFirst().orElseThrow(() -> notFound("Support access request was not found."));
    }

    private Map<String, Object> businessAnalytics() {
        long candidateCount = candidates.count();
        long recruiterCount = recruiters.count();
        long applicationCount = applications.count();
        long offers = count("select count(*) from job_applications where pipeline_stage in ('OFFER', 'ONBOARDED')");
        long onboarded = count("select count(*) from job_applications where pipeline_stage = 'ONBOARDED'");
        long activeJobs = jobs.findAll().stream().filter(job -> job.getStatus() == JobStatus.ACTIVE).count();
        long candidateActivated = count("select count(*) from candidates where email_verified and mobile_verified and registration_status = 'ACTIVE'");
        long recruiterActivated = count("select count(*) from recruiters where email_verified");
        long outreach = count("select count(*) from recruitment_campaign_recipients where delivery_status in ('SENT', 'REPLIED')");
        long replies = count("select count(*) from recruitment_campaign_recipients where delivery_status = 'REPLIED'");
        return map("candidates", candidateCount, "recruiters", recruiterCount, "organisations", organisations.count(),
                "activeJobs", activeJobs, "applications", applicationCount, "offers", offers, "onboarded", onboarded,
                "candidateActivationRate", percent(candidateActivated, candidateCount), "recruiterActivationRate", percent(recruiterActivated, recruiterCount),
                "applicationToOfferRate", percent(offers, applicationCount), "offerToOnboardRate", percent(onboarded, offers),
                "outreachDelivered", outreach, "outreachReplyRate", percent(replies, outreach));
    }

    private PlatformAdministrator requireAdministrator(UUID actor) {
        PlatformAdministrator administrator = administrators.findById(actor).filter(PlatformAdministrator::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Active Master Access is required."));
        if (administrator.getAdminRole() == null) administrator.setAdminRole(PlatformAdminRole.OWNER);
        return administrator;
    }

    private void requireMutatingRole(UUID actor) {
        PlatformAdminRole role = requireAdministrator(actor).getAdminRole();
        if (role == PlatformAdminRole.READ_ONLY) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This administrator has read-only access.");
    }

    private void requireRole(UUID actor, PlatformAdminRole... permitted) {
        PlatformAdminRole role = requireAdministrator(actor).getAdminRole();
        if (role == PlatformAdminRole.OWNER) return;
        for (PlatformAdminRole candidate : permitted) if (role == candidate) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your Master Access role does not permit this action.");
    }

    private void subjectExists(PlatformSubjectType type, UUID id) {
        boolean exists = switch (type) {
            case CANDIDATE -> candidates.existsById(id);
            case RECRUITER -> recruiters.existsById(id);
            case ORGANISATION -> organisations.existsById(id);
        };
        if (!exists) throw notFound("Support subject was not found.");
    }

    private Map<String, Object> adminView(PlatformAdministrator administrator) {
        PlatformAdminRole role = administrator.getAdminRole() == null ? PlatformAdminRole.OWNER : administrator.getAdminRole();
        return map("id", administrator.getId().toString(), "displayName", administrator.getDisplayName(), "email", administrator.getEmail(),
                "role", role.name(), "permissions", role.permissions(), "active", administrator.isActive(),
                "lastSignedInAt", value(administrator.getLastSignedInAt()));
    }

    private long count(String sql) {
        Long value = jdbc.queryForObject(sql, Long.class);
        return value == null ? 0 : value;
    }

    private int bounded(Integer requested, Object fallback, int minimum, int maximum) {
        int value = requested == null ? ((Number) fallback).intValue() : requested;
        if (value < minimum || value > maximum) throw invalid("Value must be between " + minimum + " and " + maximum + ".");
        return value;
    }

    private int percent(long numerator, long denominator) {
        return denominator == 0 ? 0 : (int) Math.round((numerator * 100d) / denominator);
    }

    private boolean booleanValue(Boolean requested, Object fallback) {
        return requested == null ? Boolean.TRUE.equals(fallback) : requested;
    }

    private String json(Map<String, Object> value) {
        try { return objectMapper.writeValueAsString(value == null ? Map.of() : value); }
        catch (JsonProcessingException exception) { throw invalid("Approval details could not be saved."); }
    }

    private String csv(String value) { return '"' + value.replace("\"", "\"\"") + '"'; }
    private String maskEmail(String email) { int at = email.indexOf('@'); return at < 1 ? "••••" : email.substring(0, 1) + "••••@" + email.substring(at + 1); }
    private String maskMobile(String mobile) { return mobile == null || mobile.length() < 4 ? "••••" : "+••••••" + mobile.substring(mobile.length() - 3); }
    private String normalized(String value) { return value == null ? "" : value.trim(); }
    private String trimToNull(String value) { return blank(value) ? null : value.trim(); }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    private String upper(String value) { return normalized(value).toUpperCase(Locale.ROOT); }
    private String value(Object value) { return value == null ? "" : String.valueOf(value); }
    private ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message); }
    private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }

    private Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) result.put(String.valueOf(values[index]), values[index + 1]);
        return result;
    }
}

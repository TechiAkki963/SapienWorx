package com.sapienworx.api.admin;

import com.sapienworx.api.audit.AuditLogCommand;
import com.sapienworx.api.audit.AuditLogWriter;
import com.sapienworx.api.communication.TransactionalEmailDispatchService;
import com.sapienworx.api.otp.OtpChallengeStore;
import com.sapienworx.api.otp.OtpChannel;
import com.sapienworx.api.otp.OtpDeliveryGateway;
import com.sapienworx.api.otp.OtpPurpose;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AdminInvitationService {
    private static final Duration INVITE_TTL = Duration.ofHours(24);
    private static final Duration ACTIVATION_TTL = Duration.ofMinutes(10);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern EMAIL = Pattern.compile("(?i)^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$");
    private static final String ACTIVATION_PREFIX = "sapienworx:admin-activation:";

    private final JdbcTemplate jdbc;
    private final PlatformAdministratorRepository administrators;
    private final PasswordEncoder passwordEncoder;
    private final StringRedisTemplate redis;
    private final OtpChallengeStore otpStore;
    private final OtpDeliveryGateway otpDelivery;
    private final TransactionalEmailDispatchService emailDispatch;
    private final AuditLogWriter auditLogWriter;

    @Value("${app.public-web-url:http://localhost:3000}")
    private String publicWebUrl;

    @Transactional
    public Map<String, Object> create(UUID actor, MasterGovernanceRequests.AdminInvitationCreate request) {
        requireOwner(actor);
        String displayName = required(request.displayName(), "Administrator name is required.");
        String email = required(request.email(), "Administrator email is required.").toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(email).matches()) throw invalid("Enter a valid administrator email address.");
        if (administrators.findByEmailIgnoreCase(email).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT, "An administrator already exists for this email address.");

        PlatformAdminRole role = request.role();
        if (role == null || role == PlatformAdminRole.OWNER) throw invalid("Choose a non-Owner administrator role. Owner responsibility must use the controlled role-transfer process.");
        Set<String> permissions = normalisePermissions(role, request.permissions());
        UUID invitationId = UUID.randomUUID();
        String token = newToken();
        Instant expiresAt = Instant.now().plus(INVITE_TTL);

        jdbc.update("update platform_admin_invitations set revoked_at = now() where lower(email) = lower(?) and accepted_at is null and revoked_at is null", email);
        jdbc.update("""
                insert into platform_admin_invitations
                    (id, display_name, email, admin_role, permissions, token_hash, invited_by, expires_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """, invitationId, displayName, email, role.name(), String.join(",", permissions.stream().sorted().toList()), sha256(token), actor, expiresAt);

        String activationUrl = publicWebUrl.replaceAll("/+$", "") + "/admin/activate?token=" + token;
        emailDispatch.queue(invitationId, email, null, "Activate your Sapienworx Master Access",
                "<p>You have been invited to Sapienworx Master Access.</p>"
                        + "<p>This invitation expires in 24 hours and can be used once.</p>"
                        + "<p><a href=\"" + activationUrl + "\">Activate administrator access</a></p>"
                        + "<p>If you were not expecting this invitation, do not use the link.</p>");
        auditLogWriter.record(new AuditLogCommand(actor, "MASTER_ADMIN_INVITATION_CREATED", "PLATFORM_ADMIN_INVITATION", invitationId, null, null, null));
        return invitationView(invitationId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(UUID actor) {
        requireOwner(actor);
        return jdbc.query("""
                select invitation.*, inviter.display_name invited_by_name
                from platform_admin_invitations invitation
                join platform_administrators inviter on inviter.id = invitation.invited_by
                order by invitation.created_at desc limit 100
                """, (rs, row) -> invitationMap(rs));
    }

    @Transactional
    public Map<String, Object> revoke(UUID actor, UUID invitationId) {
        requireOwner(actor);
        int changed = jdbc.update("""
                update platform_admin_invitations set revoked_at = now()
                where id = ? and accepted_at is null and revoked_at is null and expires_at > now()
                """, invitationId);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "This invitation is already expired, used, revoked, or unavailable.");
        auditLogWriter.record(new AuditLogCommand(actor, "MASTER_ADMIN_INVITATION_REVOKED", "PLATFORM_ADMIN_INVITATION", invitationId, null, null, null));
        return invitationView(invitationId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> inspectToken(String token) {
        Map<String, Object> invitation = activeInvitationByToken(token);
        return Map.of(
                "displayName", invitation.get("display_name"),
                "email", maskEmail(String.valueOf(invitation.get("email"))),
                "role", invitation.get("admin_role"),
                "expiresAt", String.valueOf(invitation.get("expires_at"))
        );
    }

    @Transactional
    public Map<String, Object> beginActivation(MasterGovernanceRequests.AdminInvitationActivate request) {
        if (request == null) throw invalid("Activation details are required.");
        Map<String, Object> invitation = activeInvitationByToken(request.token());
        String password = request.password() == null ? "" : request.password();
        int minimumLength = jdbc.queryForObject("select minimum_password_length from platform_security_policy where id = true", Integer.class);
        if (password.length() < minimumLength) throw invalid("Choose a password of at least " + minimumLength + " characters.");
        if (password.length() > 128) throw invalid("Password must be at most 128 characters.");

        UUID invitationId = UUID.fromString(String.valueOf(invitation.get("id")));
        String activationId = UUID.randomUUID().toString();
        String prefix = ACTIVATION_PREFIX + activationId + ":";
        redis.opsForValue().set(prefix + "invitation", invitationId.toString(), ACTIVATION_TTL);
        redis.opsForValue().set(prefix + "password", passwordEncoder.encode(password), ACTIVATION_TTL);
        String otp = otpStore.issue(activationId, OtpPurpose.ADMIN_ACTIVATION, OtpChannel.EMAIL);
        String email = String.valueOf(invitation.get("email"));
        otpDelivery.dispatch(activationId, OtpPurpose.ADMIN_ACTIVATION, OtpChannel.EMAIL, email, otp);
        return Map.of("activationId", activationId, "email", maskEmail(email), "expiresInMinutes", ACTIVATION_TTL.toMinutes());
    }

    @Transactional
    public Map<String, Object> verifyActivation(MasterGovernanceRequests.AdminInvitationVerify request) {
        if (request == null || request.activationId() == null || request.activationId().isBlank()) throw invalid("Activation session is required.");
        String activationId = request.activationId().trim();
        if (otpStore.attemptsExceeded(activationId, OtpPurpose.ADMIN_ACTIVATION, OtpChannel.EMAIL)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many incorrect codes. Start activation again from the invitation link.");
        }
        if (!otpStore.verify(activationId, OtpPurpose.ADMIN_ACTIVATION, OtpChannel.EMAIL, request.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "That verification code is invalid or has expired.");
        }

        String prefix = ACTIVATION_PREFIX + activationId + ":";
        String invitationIdValue = redis.opsForValue().get(prefix + "invitation");
        String passwordHash = redis.opsForValue().get(prefix + "password");
        if (invitationIdValue == null || passwordHash == null) throw new ResponseStatusException(HttpStatus.GONE, "This activation session expired. Start again from the invitation link.");
        UUID invitationId = UUID.fromString(invitationIdValue);
        Map<String, Object> invitation = activeInvitationById(invitationId);
        String email = String.valueOf(invitation.get("email"));
        if (administrators.findByEmailIgnoreCase(email).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT, "An administrator account already exists for this email address.");

        UUID administratorId = UUID.randomUUID();
        PlatformAdminRole role = PlatformAdminRole.valueOf(String.valueOf(invitation.get("admin_role")));
        List<String> storedPermissions = java.util.Arrays.stream(String.valueOf(invitation.get("permissions")).split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .sorted()
                .toList();
        PlatformAdministrator administrator = PlatformAdministrator.builder()
                .id(administratorId)
                .displayName(String.valueOf(invitation.get("display_name")))
                .email(email)
                .passwordHash(passwordHash)
                .active(true)
                .adminRole(role)
                .permissions(storedPermissions)
                .build();
        administrators.save(administrator);
        jdbc.update("update platform_admin_invitations set accepted_at = now(), accepted_admin_id = ? where id = ?", administratorId, invitationId);
        redis.delete(List.of(prefix + "invitation", prefix + "password"));

        UUID inviter = UUID.fromString(String.valueOf(invitation.get("invited_by")));
        auditLogWriter.record(new AuditLogCommand(inviter, "MASTER_ADMIN_INVITATION_ACCEPTED", "PLATFORM_ADMIN", administratorId, null, invitationId, null));
        return Map.of("activated", true, "redirectTo", "/admin/login", "role", role.name());
    }

    private Set<String> normalisePermissions(PlatformAdminRole role, List<String> requested) {
        Set<String> ceiling = Set.copyOf(role.permissions());
        Set<String> permissions = new LinkedHashSet<>(requested == null || requested.isEmpty() ? role.permissions() : requested);
        permissions.removeIf(value -> value == null || value.isBlank());
        permissions.add("platform.read");
        if (!ceiling.containsAll(permissions)) throw invalid("One or more permissions fall outside the selected administrator role.");
        return permissions;
    }

    private Map<String, Object> activeInvitationByToken(String token) {
        if (token == null || token.isBlank()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Administrator invitation was not found.");
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select * from platform_admin_invitations
                where token_hash = ? and accepted_at is null and revoked_at is null and expires_at > now()
                """, sha256(token.trim()));
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.GONE, "This administrator invitation is invalid, expired, revoked, or already used.");
        return rows.get(0);
    }

    private Map<String, Object> activeInvitationById(UUID id) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select * from platform_admin_invitations
                where id = ? and accepted_at is null and revoked_at is null and expires_at > now()
                """, id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.GONE, "This administrator invitation is no longer active.");
        return rows.get(0);
    }

    private Map<String, Object> invitationView(UUID id) {
        return jdbc.queryForObject("""
                select invitation.*, inviter.display_name invited_by_name
                from platform_admin_invitations invitation join platform_administrators inviter on inviter.id = invitation.invited_by
                where invitation.id = ?
                """, (rs, row) -> invitationMap(rs), id);
    }

    private Map<String, Object> invitationMap(java.sql.ResultSet rs) throws java.sql.SQLException {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", rs.getString("id"));
        result.put("displayName", rs.getString("display_name"));
        result.put("email", rs.getString("email"));
        result.put("role", rs.getString("admin_role"));
        result.put("permissions", List.of(rs.getString("permissions").split(",")));
        result.put("invitedBy", rs.getString("invited_by_name"));
        result.put("createdAt", String.valueOf(rs.getObject("created_at")));
        result.put("expiresAt", String.valueOf(rs.getObject("expires_at")));
        result.put("acceptedAt", rs.getObject("accepted_at") == null ? "" : String.valueOf(rs.getObject("accepted_at")));
        result.put("revokedAt", rs.getObject("revoked_at") == null ? "" : String.valueOf(rs.getObject("revoked_at")));
        String status = rs.getObject("accepted_at") != null ? "ACCEPTED" : rs.getObject("revoked_at") != null ? "REVOKED"
                : rs.getTimestamp("expires_at").toInstant().isBefore(Instant.now()) ? "EXPIRED" : "PENDING";
        result.put("status", status);
        return result;
    }

    private void requireOwner(UUID actor) {
        PlatformAdministrator administrator = administrators.findById(actor).filter(PlatformAdministrator::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Active Master Access is required."));
        if (administrator.getAdminRole() != PlatformAdminRole.OWNER) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only an Owner can invite or revoke administrators.");
    }

    private String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        return at < 2 ? "••••" : email.substring(0, 2) + "••••@" + email.substring(at + 1);
    }

    private String required(String value, String message) {
        if (value == null || value.isBlank()) throw invalid(message);
        return value.trim();
    }

    private ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }
}

package com.sapienworx.api.auth;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.audit.AuditLogCommand;
import com.sapienworx.api.audit.AuditLogWriter;
import com.sapienworx.api.admin.PlatformAdministrator;
import com.sapienworx.api.admin.PlatformAdministratorRepository;
import com.sapienworx.api.admin.PlatformControlsRepository;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import com.sapienworx.api.candidate.CandidateCareerStage;
import com.sapienworx.api.candidate.CandidateRegistrationStatus;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.otp.OtpChallengeStore;
import com.sapienworx.api.otp.OtpChannel;
import com.sapienworx.api.otp.OtpDeliveryGateway;
import com.sapienworx.api.otp.OtpPurpose;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.organisation.OrganisationRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.recruiter.RecruiterType;
import com.sapienworx.api.recruiter.RecruiterAccountReviewStatus;
import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.PlatformRole;
import com.sapienworx.api.taxonomy.DomainCategory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** Coordinates the transient OTP exchange and creates a session only after required proof. */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthenticationService {
    private static final Duration TRANSACTION_TTL = Duration.ofMinutes(10);
    private static final Duration OTP_REQUEST_COOLDOWN = Duration.ofSeconds(30);
    private static final String TRANSACTION_PREFIX = "sapienworx:auth:transaction:";
    private static final String OTP_COOLDOWN_PREFIX = "sapienworx:auth:otp-cooldown:";
    private static final Set<String> SUPPORTED_INTERESTED_DOMAINS = Set.of(
            "Technology", "IT Services", "Manufacturing & Production", "Healthcare & Life Sciences",
            "Infrastructure, Transport & Real Estate", "BFSI", "BPM", "Consumer, Retail & Hospitality",
            "Media, Entertainment & Telecom", "Education"
    );

    private final OtpChallengeStore otpChallengeStore;
    private final OtpDeliveryGateway otpDeliveryGateway;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final PasswordEncoder passwordEncoder;
    private final CandidateRepository candidateRepository;
    private final RecruiterRepository recruiterRepository;
    private final OrganisationRepository organisationRepository;
    private final PlatformAdministratorRepository platformAdministratorRepository;
    private final PlatformControlsRepository platformControlsRepository;
    private final PlatformAccessPolicy platformAccessPolicy;
    private final AccountSessionService accountSessionService;
    private final CandidateRecoveryCodeService recoveryCodes;
    private final AuditLogWriter auditLogWriter;

    public OtpRequestResponse requestOtp(OtpRequest request, String trustedDeviceToken) {
        PendingAuthentication pending = preparePending(request, trustedDeviceToken);
        enforceOtpRequestCooldown(pending);
        String transactionId = UUID.randomUUID().toString();
        save(transactionId, pending);

        for (OtpChannel channel : pending.requiredChannels()) {
            String code = otpChallengeStore.issue(transactionId, purposeFor(pending.flow()), channel);
            otpDeliveryGateway.dispatch(transactionId, purposeFor(pending.flow()), channel, destinationFor(pending, channel), code);
        }
        boolean trusted = pending.flow() == AuthFlow.SIGN_IN && pending.role() == PlatformRole.CANDIDATE
                && !pending.requiredChannels().contains(OtpChannel.MOBILE);
        return new OtpRequestResponse(transactionId, pending.requiredChannels(), trusted);
    }

    @Transactional
    public AuthSessionResponse verifyOtp(OtpVerificationRequest request) {
        PendingAuthentication pending = find(request.transactionId());
        if (!pending.requiredChannels().contains(request.channel())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This verification channel was not requested.");
        }
        if (pending.verifiedChannels().contains(request.channel())) {
            return completionOrPending(request.transactionId(), pending);
        }
        if (!otpChallengeStore.verify(request.transactionId(), purposeFor(pending.flow()), request.channel(), request.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "That verification code is invalid or has expired.");
        }

        PendingAuthentication verified = pending.withVerified(request.channel());
        save(request.transactionId(), verified);
        return completionOrPending(request.transactionId(), verified);
    }

    public AuthenticatedUser authenticatedUser(UUID id, PlatformRole role) {
        return new AuthenticatedUser(id, role);
    }

    @Transactional
    public AuthSessionResponse verifyRecoveryCode(RecoveryCodeVerificationRequest request) {
        PendingAuthentication pending = find(request.transactionId());
        if (pending.flow() != AuthFlow.SIGN_IN || pending.role() != PlatformRole.CANDIDATE
                || pending.existingUserId() == null || !pending.requiredChannels().contains(OtpChannel.MOBILE)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A recovery code cannot be used for this verification request.");
        }
        if (!pending.verifiedChannels().contains(OtpChannel.EMAIL)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Verify the email code before using a recovery code.");
        }
        if (!recoveryCodes.consume(pending.existingUserId(), request.recoveryCode())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "That recovery code is invalid or has already been used.");
        }
        PendingAuthentication verified = pending.withVerified(OtpChannel.MOBILE);
        save(request.transactionId(), verified);
        return completionOrPending(request.transactionId(), verified);
    }

    private AuthSessionResponse completionOrPending(String transactionId, PendingAuthentication pending) {
        Set<OtpChannel> remaining = new LinkedHashSet<>(pending.requiredChannels());
        remaining.removeAll(pending.verifiedChannels());
        if (!remaining.isEmpty()) {
            return AuthSessionResponse.pending(Set.copyOf(remaining));
        }

        AuthenticatedUser user = switch (pending.flow()) {
            case CANDIDATE_REGISTRATION -> registerCandidate(pending);
            case RECRUITER_REGISTRATION, CONSULTANT_REGISTRATION -> registerRecruiter(pending);
            case SIGN_IN -> new AuthenticatedUser(pending.existingUserId(), pending.role());
        };
        if (pending.flow() == AuthFlow.SIGN_IN && pending.role() == PlatformRole.SUPER_ADMIN) {
            platformAdministratorRepository.findById(user.userId()).ifPresent(administrator -> {
                administrator.setLastSignedInAt(Instant.now());
                platformAdministratorRepository.save(administrator);
            });
        }
        recordAccountActivity(user, pending.flow());
        redisTemplate.delete(transactionKey(transactionId));
        return new AuthSessionResponse(true, user.userId(), user.role(), redirectFor(user.role()), Set.of());
    }

    private void recordAccountActivity(AuthenticatedUser user, AuthFlow flow) {
        try {
            auditLogWriter.record(new AuditLogCommand(user.userId(), flow == AuthFlow.SIGN_IN ? "ACCOUNT_SIGNED_IN" : "ACCOUNT_REGISTERED",
                    "ACCOUNT", user.userId(), user.role() == PlatformRole.CANDIDATE ? user.userId() : null, null, null));
        } catch (RuntimeException exception) {
            // Authentication must remain available if non-critical compliance persistence is temporarily degraded.
            log.error("Could not record account activity for role {}", user.role(), exception);
        }
    }

    private PendingAuthentication preparePending(OtpRequest request, String trustedDeviceToken) {
        if (request.flow() != AuthFlow.SIGN_IN) platformAccessPolicy.requirePublicPlatformAvailable();
        if (request.flow() == AuthFlow.SIGN_IN) {
            return signInPending(request, trustedDeviceToken);
        }
        var platformControls = platformControlsRepository.findById(true).orElse(null);
        if (request.flow() == AuthFlow.CANDIDATE_REGISTRATION && platformControls != null && !platformControls.isCandidateSignupEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Candidate registration is temporarily unavailable.");
        }
        if ((request.flow() == AuthFlow.RECRUITER_REGISTRATION || request.flow() == AuthFlow.CONSULTANT_REGISTRATION) && platformControls != null && !platformControls.isRecruiterSignupEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Recruiter registration is temporarily unavailable.");
        }

        String email = normalizeEmail(request.email());
        String mobile = normalizeMobile(request.mobile());
        if (request.flow() == AuthFlow.CANDIDATE_REGISTRATION) {
            String name = candidateName(request.firstName(), request.lastName());
            String password = required(request.password(), "A password of at least eight characters is required.");
            DomainCategory domainCategory = candidateDomain(request.domainCategory());
            CandidateCareerStage careerStage = candidateCareerStage(request.careerStage());
            List<String> interestedDomains = candidateInterests(request.interestedDomains());
            if (!Boolean.TRUE.equals(request.termsAccepted())) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Accept the Terms and Data Processing Agreement before registration.");
            }
            if (candidateRepository.existsByEmailOrMobile(email, mobile)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "An account already exists for this email or mobile number.");
            }
            return new PendingAuthentication(request.flow(), PlatformRole.CANDIDATE, null, name, email, mobile,
                    passwordEncoder.encode(password), true, Boolean.TRUE.equals(request.automationConsent()),
                    null, null, null, null, null, null, null, null, domainCategory, careerStage, interestedDomains,
                    Set.of(OtpChannel.EMAIL, OtpChannel.MOBILE), Set.of());
        }

        validateOfficialEmail(email);
        if (recruiterRepository.findByOfficialEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A recruiter account already exists for this email.");
        }
        AuthFlow flow = request.flow();
        if (flow != AuthFlow.RECRUITER_REGISTRATION && flow != AuthFlow.CONSULTANT_REGISTRATION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported authentication flow.");
        }
        String password = required(request.password(), "A password of at least eight characters is required.");
        String name = recruiterName(request.firstName(), request.lastName());
        String location = recruiterLocation(request.city(), request.state(), request.location());
        String organisationName = required(request.organisationName(), "Organisation is required.");
        String workEmailDomain = email.substring(email.indexOf('@') + 1).toLowerCase(Locale.ROOT);
        organisationRepository.findByNameIgnoreCase(organisationName).ifPresent(organisation -> {
            if (organisation.getWorkEmailDomain() != null && !organisation.getWorkEmailDomain().equalsIgnoreCase(workEmailDomain)) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "The work email domain does not match this organisation. Choose the matching company or ask an administrator to review it.");
            }
        });
        Set<OtpChannel> channels = flow == AuthFlow.CONSULTANT_REGISTRATION
                ? Set.of(OtpChannel.EMAIL, OtpChannel.MOBILE) : Set.of(OtpChannel.EMAIL);
        return new PendingAuthentication(flow, PlatformRole.RECRUITER, null, name, email, mobile,
                passwordEncoder.encode(password), false, false,
                organisationName,
                required(request.designation(), "Designation is required."), location,
                null, null, null, null, null, null, null, List.of(), channels, Set.of());
    }

    private PendingAuthentication signInPending(OtpRequest request, String trustedDeviceToken) {
        PlatformRole role = request.role();
        if (role != PlatformRole.CANDIDATE && role != PlatformRole.RECRUITER && role != PlatformRole.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a valid account type.");
        }
        String email = normalizeEmail(request.email());
        String password = required(request.password(), "Password is required.");
        if (role == PlatformRole.SUPER_ADMIN) {
            PlatformAdministrator administrator = platformAdministratorRepository.findByEmailIgnoreCase(email).orElseThrow(() -> invalidCredentials());
            if (!administrator.isActive() || !passwordEncoder.matches(password, administrator.getPasswordHash())) throw invalidCredentials();
            AuthenticatedUser user = new AuthenticatedUser(administrator.getId(), role);
            platformAccessPolicy.requireSignInAllowed(user);
            return new PendingAuthentication(AuthFlow.SIGN_IN, role, administrator.getId(), administrator.getDisplayName(), administrator.getEmail(), null, null, false, false, null, null, null, null, null, null, null, null, null, null, List.of(), Set.of(OtpChannel.EMAIL), Set.of());
        }
        if (role == PlatformRole.CANDIDATE) {
            Candidate candidate = candidateRepository.findByEmail(email).orElseThrow(() -> invalidCredentials());
            if (candidate.getPasswordHash() == null || !passwordEncoder.matches(password, candidate.getPasswordHash())) {
                throw invalidCredentials();
            }
            if (candidate.getRegistrationStatus() != CandidateRegistrationStatus.ACTIVE) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Complete account verification before signing in.");
            }
            platformAccessPolicy.requireSignInAllowed(new AuthenticatedUser(candidate.getId(), role));
            Set<OtpChannel> candidateChannels = accountSessionService.isTrustedCandidateDevice(candidate.getId(), trustedDeviceToken)
                    ? Set.of(OtpChannel.EMAIL) : Set.of(OtpChannel.EMAIL, OtpChannel.MOBILE);
            return new PendingAuthentication(AuthFlow.SIGN_IN, role, candidate.getId(), candidate.getFullName(),
                    candidate.getEmail(), candidate.getMobile(), null, false, false, null, null, null,
                    null, null, null, null, null, null, null, List.of(), candidateChannels, Set.of());
        }

        Recruiter recruiter = recruiterRepository.findByOfficialEmail(email).orElseThrow(() -> invalidCredentials());
        if (recruiter.getPasswordHash() == null || !passwordEncoder.matches(password, recruiter.getPasswordHash())) {
            throw invalidCredentials();
        }
        platformAccessPolicy.requireSignInAllowed(new AuthenticatedUser(recruiter.getId(), role));
        Set<OtpChannel> channels = recruiter.getRecruiterType() == RecruiterType.CONSULTANT
                ? Set.of(OtpChannel.EMAIL, OtpChannel.MOBILE) : Set.of(OtpChannel.EMAIL);
        return new PendingAuthentication(AuthFlow.SIGN_IN, role, recruiter.getId(), recruiter.getFullName(),
                recruiter.getOfficialEmail(), recruiter.getMobile(), null, false, false, null, null, null,
                null, null, null, null, null, null, null, List.of(), channels, Set.of());
    }

    private AuthenticatedUser registerCandidate(PendingAuthentication pending) {
        Candidate candidate = Candidate.builder()
                .fullName(pending.fullName())
                .email(pending.email())
                .mobile(pending.mobile())
                .passwordHash(pending.passwordHash())
                .headline(pending.headline())
                .currentCompany(pending.currentCompany())
                .location(pending.location())
                .overallExperienceYears(pending.overallExperienceYears())
                .expectedSalaryLakhs(pending.expectedSalaryLakhs())
                .noticePeriodDays(pending.noticePeriodDays())
                .domainCategory(pending.domainCategory())
                .careerStage(pending.careerStage())
                .interestedDomains(pending.interestedDomains())
                .emailVerified(true)
                .mobileVerified(true)
                .termsAccepted(pending.termsAccepted())
                .automationConsent(pending.automationConsent())
                .build();
        candidate.activateAfterDualVerification();
        return new AuthenticatedUser(candidateRepository.save(candidate).getId(), PlatformRole.CANDIDATE);
    }

    private AuthenticatedUser registerRecruiter(PendingAuthentication pending) {
        String workEmailDomain = pending.email().substring(pending.email().indexOf('@') + 1).toLowerCase(Locale.ROOT);
        Organisation organisation = organisationRepository.findByNameIgnoreCase(pending.organisationName())
                .orElseGet(() -> organisationRepository.save(Organisation.builder()
                        .name(pending.organisationName())
                        .initials(initials(pending.organisationName()))
                        .workEmailDomain(workEmailDomain)
                        .build()));
        if (organisation.getWorkEmailDomain() != null && !organisation.getWorkEmailDomain().equalsIgnoreCase(workEmailDomain)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "The work email domain does not match this organisation. Choose the matching company or ask an administrator to review it.");
        }
        if (organisation.getWorkEmailDomain() == null) organisation.setWorkEmailDomain(workEmailDomain);
        boolean consultant = pending.flow() == AuthFlow.CONSULTANT_REGISTRATION;
        Recruiter recruiter = Recruiter.builder()
                .fullName(pending.fullName())
                .officialEmail(pending.email())
                .mobile(pending.mobile())
                .passwordHash(pending.passwordHash())
                .organisation(organisation)
                .designation(pending.designation())
                .location(pending.location())
                .recruiterType(consultant ? RecruiterType.CONSULTANT : RecruiterType.EMPLOYER)
                .accountReviewStatus(RecruiterAccountReviewStatus.PENDING)
                .reviewDueAt(java.time.Instant.now().plus(java.time.Duration.ofDays(1)))
                .emailVerified(true)
                .mobileVerified(consultant)
                .build();
        return new AuthenticatedUser(recruiterRepository.save(recruiter).getId(), PlatformRole.RECRUITER);
    }

    private PendingAuthentication find(String transactionId) {
        try {
            String serialized = redisTemplate.opsForValue().get(transactionKey(transactionId));
            if (serialized == null) throw new ResponseStatusException(HttpStatus.GONE, "This verification request has expired. Request new codes.");
            return objectMapper.readValue(serialized, PendingAuthentication.class);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to read verification state.");
        }
    }

    private void save(String transactionId, PendingAuthentication pending) {
        try {
            redisTemplate.opsForValue().set(transactionKey(transactionId), objectMapper.writeValueAsString(pending), TRANSACTION_TTL);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to retain verification state.");
        }
    }

    private String destinationFor(PendingAuthentication pending, OtpChannel channel) {
        return channel == OtpChannel.EMAIL ? pending.email() : pending.mobile();
    }

    private OtpPurpose purposeFor(AuthFlow flow) {
        return switch (flow) {
            case CANDIDATE_REGISTRATION -> OtpPurpose.CANDIDATE_REGISTRATION;
            case RECRUITER_REGISTRATION -> OtpPurpose.RECRUITER_REGISTRATION;
            case CONSULTANT_REGISTRATION -> OtpPurpose.CONSULTANT_REGISTRATION;
            case SIGN_IN -> OtpPurpose.SIGN_IN;
        };
    }

    private String redirectFor(PlatformRole role) { return role == PlatformRole.CANDIDATE ? "/candidate" : role == PlatformRole.SUPER_ADMIN ? "/admin" : "/recruiter"; }
    private String transactionKey(String transactionId) { return TRANSACTION_PREFIX + transactionId; }
    private void enforceOtpRequestCooldown(PendingAuthentication pending) {
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(
                OTP_COOLDOWN_PREFIX + fingerprint(pending.flow().name() + ":" + pending.email() + ":" + pending.mobile()),
                "1", OTP_REQUEST_COOLDOWN);
        if (!Boolean.TRUE.equals(acquired)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "A verification code was recently requested. Please wait 30 seconds before requesting another.");
        }
    }
    private String fingerprint(String value) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 must be available for OTP rate limiting.", exception);
        }
    }
    private ResponseStatusException invalidCredentials() { return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect."); }

    private String required(String value, String message) {
        if (value == null || value.isBlank()) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
        return value.trim();
    }
    private String optional(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private Integer requiredNumber(Integer value, int min, int max, String message) {
        if (value == null || value < min || value > max) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
        return value;
    }
    private Integer optionalNumber(Integer value, int min, int max) {
        if (value == null) return null;
        return requiredNumber(value, min, max, "Enter a valid value.");
    }
    private String normalizeEmail(String value) { return required(value, "Email is required.").toLowerCase(Locale.ROOT); }
    private String normalizeMobile(String value) {
        String normalized = required(value, "Mobile number is required.").replaceAll("[\\s()-]", "");
        // Accept the common Indian local-number format (0XXXXXXXXXX) and
        // persist the canonical E.164 form used by OTP delivery.
        if (normalized.matches("0[6-9]\\d{9}")) normalized = normalized.substring(1);
        if (!normalized.matches("\\+?[1-9]\\d{7,14}")) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Enter a valid mobile number including country code.");
        return normalized.startsWith("+") ? normalized : "+91" + normalized;
    }
    private String recruiterName(String firstName, String lastName) {
        return required(firstName, "First name is required.") + " " + required(lastName, "Last name is required.");
    }
    private String candidateName(String firstName, String lastName) {
        return required(firstName, "First name is required.") + " " + required(lastName, "Last name is required.");
    }
    private DomainCategory candidateDomain(DomainCategory value) {
        if (value != DomainCategory.TECH && value != DomainCategory.NON_TECH) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose Technology / IT or Non-technology before verification.");
        }
        return value;
    }
    private CandidateCareerStage candidateCareerStage(CandidateCareerStage value) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose Fresher or Experienced before verification.");
        }
        return value;
    }
    private List<String> candidateInterests(List<String> values) {
        List<String> selected = values == null ? List.of() : values.stream()
                .filter(value -> value != null && !value.isBlank()).map(String::trim).distinct().toList();
        if (selected.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Select at least one interested domain before verification.");
        }
        if (!SUPPORTED_INTERESTED_DOMAINS.containsAll(selected)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose interested domains from the supported list.");
        }
        return selected;
    }
    private String recruiterLocation(String city, String state, String legacyLocation) {
        if (city != null || state != null) {
            return required(city, "City is required.") + ", " + required(state, "State is required.");
        }
        return required(legacyLocation, "City and state are required.");
    }
    private void validateOfficialEmail(String email) {
        String domain = email.substring(email.indexOf('@') + 1);
        if (Set.of("gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com").contains(domain)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Use an official work email address.");
        }
    }
    private String initials(String organisationName) {
        String initials = java.util.Arrays.stream(organisationName.split("\\s+"))
                .filter(part -> !part.isBlank()).map(part -> part.substring(0, 1).toUpperCase(Locale.ROOT))
                .limit(6).reduce("", String::concat);
        return initials.isBlank() ? "SWX" : initials;
    }

    public record RecoveryCodeVerificationRequest(String transactionId, String recoveryCode, Boolean trustDevice) { }
}

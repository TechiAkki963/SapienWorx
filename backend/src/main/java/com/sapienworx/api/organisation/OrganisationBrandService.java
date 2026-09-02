package com.sapienworx.api.organisation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.workflow.OrganisationMemberRoleRepository;
import com.sapienworx.api.workflow.OrganisationWorkspaceRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrganisationBrandService {
    private final OrganisationRepository organisations;
    private final RecruiterRepository recruiters;
    private final OrganisationMemberRoleRepository memberRoles;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public OrganisationBrandResponse recruiterProfile(UUID recruiterId) {
        Recruiter recruiter = recruiter(recruiterId);
        return response(recruiter.getOrganisation(), isOrgAdmin(recruiterId));
    }

    @Transactional
    public OrganisationBrandResponse updateByRecruiter(UUID recruiterId, OrganisationBrandRequests.Update request) {
        Recruiter recruiter = recruiter(recruiterId);
        requireOrgAdmin(recruiterId);
        Organisation organisation = recruiter.getOrganisation();
        apply(organisation, request, true);
        organisation.setBrandVerificationStatus(request.submitForVerification()
                ? OrganisationBrandVerificationStatus.PENDING_VERIFICATION : OrganisationBrandVerificationStatus.DRAFT);
        organisation.setBrandVerificationNote(null);
        organisation.setBrandVerifiedAt(null);
        organisation.setBrandVerifiedBy(null);
        organisation.setBrandUpdatedAt(Instant.now());
        organisations.save(organisation);
        history(organisation, recruiterId, "ORGANISATION_ADMIN", request.submitForVerification() ? "SUBMITTED" : "DRAFT_SAVED", null);
        return response(organisation, true);
    }

    @Transactional(readOnly = true)
    public List<OrganisationBrandResponse> adminProfiles() {
        return organisations.findAllByOrderByBrandUpdatedAtDesc().stream().map(value -> response(value, true)).toList();
    }

    @Transactional
    public OrganisationBrandResponse updateByAdmin(UUID adminId, UUID organisationId, OrganisationBrandRequests.Update request) {
        Organisation organisation = organisation(organisationId);
        apply(organisation, request, false);
        organisation.setBrandVerificationStatus(request.submitForVerification()
                ? OrganisationBrandVerificationStatus.PENDING_VERIFICATION : OrganisationBrandVerificationStatus.DRAFT);
        organisation.setBrandVerificationNote("Company details updated by Sapienworx assisted onboarding.");
        organisation.setBrandVerifiedAt(null);
        organisation.setBrandVerifiedBy(null);
        organisation.setBrandUpdatedAt(Instant.now());
        organisations.save(organisation);
        history(organisation, adminId, "MASTER_ADMIN", "ASSISTED_UPDATE", organisation.getBrandVerificationNote());
        return response(organisation, true);
    }

    @Transactional
    public OrganisationBrandResponse decide(UUID adminId, UUID organisationId, OrganisationBrandRequests.Decision request) {
        if (!List.of(OrganisationBrandVerificationStatus.VERIFIED, OrganisationBrandVerificationStatus.NEEDS_INFORMATION,
                OrganisationBrandVerificationStatus.REJECTED, OrganisationBrandVerificationStatus.SUSPENDED).contains(request.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid review decision.");
        }
        Organisation organisation = organisation(organisationId);
        if (request.status() == OrganisationBrandVerificationStatus.VERIFIED) requireComplete(organisation);
        organisation.setBrandVerificationStatus(request.status());
        organisation.setBrandVerificationNote(request.note().trim());
        organisation.setBrandUpdatedAt(Instant.now());
        if (request.status() == OrganisationBrandVerificationStatus.VERIFIED) {
            organisation.setBrandVerifiedAt(Instant.now());
            organisation.setBrandVerifiedBy(adminId);
            organisation.setName(organisation.getDisplayName());
            organisation.setInitials(initials(organisation.getDisplayName()));
        } else {
            organisation.setBrandVerifiedAt(null);
            organisation.setBrandVerifiedBy(null);
        }
        organisations.save(organisation);
        history(organisation, adminId, "MASTER_ADMIN", request.status().name(), request.note().trim());
        return response(organisation, true);
    }

    private void apply(Organisation organisation, OrganisationBrandRequests.Update request, boolean enforceEmailDomain) {
        String website = companyWebsite(request.websiteUrl());
        String linkedIn = optionalHttpsUrl(request.linkedinUrl(), "LinkedIn page");
        String logo = optionalHttpsUrl(request.logoUrl(), "Company logo");
        String websiteHost = normalizedHost(URI.create(website));
        if (linkedIn != null && !normalizedHost(URI.create(linkedIn)).matches("(^|.*\\.)linkedin\\.com$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use the organisation's official LinkedIn company page.");
        }
        if (logo != null) {
            String logoHost = normalizedHost(URI.create(logo));
            if (!logoHost.equals(websiteHost) && !logoHost.endsWith(".sapienworx.com")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The logo must be hosted on the company website or Sapienworx managed storage.");
            }
        }
        organisations.findByWebsiteUrlIgnoreCase(website).filter(other -> !other.getId().equals(organisation.getId()))
                .ifPresent(other -> conflict("This website is already linked to " + other.getName() + "."));
        organisations.findByWorkEmailDomainIgnoreCase(websiteHost).filter(other -> !other.getId().equals(organisation.getId()))
                .ifPresent(other -> conflict("This website domain is already claimed by " + other.getName() + "."));
        if (enforceEmailDomain && organisation.getWorkEmailDomain() != null && !organisation.getWorkEmailDomain().isBlank()
                && !domainMatches(organisation.getWorkEmailDomain(), websiteHost)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The company website must match the verified work-email domain.");
        }
        organisation.setLegalName(request.legalName().trim());
        organisation.setDisplayName(request.displayName().trim());
        organisation.setWebsiteUrl(website);
        organisation.setLogoUrl(logo);
        organisation.setIndustry(request.industry().trim());
        organisation.setCompanySize(request.companySize().trim());
        organisation.setHeadquarters(request.headquarters().trim());
        organisation.setCandidateDescription(request.candidateDescription().trim());
        organisation.setLinkedinUrl(linkedIn);
        organisation.setRegistrationReference(blankToNull(request.registrationReference()));
        organisation.setBrandColour(request.brandColour() == null || request.brandColour().isBlank() ? "#144A75" : request.brandColour().toUpperCase(Locale.ROOT));
    }

    private void requireComplete(Organisation value) {
        if (blank(value.getLegalName()) || blank(value.getDisplayName()) || blank(value.getWebsiteUrl()) || blank(value.getIndustry())
                || blank(value.getCompanySize()) || blank(value.getHeadquarters()) || blank(value.getCandidateDescription())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Complete the required company identity fields before approval.");
        }
    }

    private OrganisationBrandResponse response(Organisation value, boolean editable) {
        return new OrganisationBrandResponse(value.getId(), defaultValue(value.getLegalName(), value.getName()), defaultValue(value.getDisplayName(), value.getName()),
                value.getWorkEmailDomain(), value.getWebsiteUrl(), value.getLogoUrl(), value.getIndustry(), value.getCompanySize(), value.getHeadquarters(),
                value.getCandidateDescription(), value.getLinkedinUrl(), value.getRegistrationReference(), defaultValue(value.getBrandColour(), "#144A75"),
                value.getBrandVerificationStatus() == null ? OrganisationBrandVerificationStatus.DRAFT : value.getBrandVerificationStatus(),
                value.getBrandVerificationNote(), value.getBrandVerifiedAt(), value.getBrandUpdatedAt(), editable, history(value.getId()));
    }

    private List<OrganisationBrandResponse.History> history(UUID organisationId) {
        return jdbc.query("select id, actor_type, action, decision_note, created_at from organisation_brand_history where organisation_id = ? order by created_at desc limit 12",
                (rs, row) -> new OrganisationBrandResponse.History(UUID.fromString(rs.getString("id")), rs.getString("actor_type"), rs.getString("action"),
                        rs.getString("decision_note"), rs.getTimestamp("created_at").toInstant()), organisationId);
    }

    private void history(Organisation value, UUID actorId, String actorType, String action, String note) {
        try {
            String snapshot = objectMapper.writeValueAsString(Map.ofEntries(Map.entry("legalName", defaultValue(value.getLegalName(), "")),
                    Map.entry("displayName", defaultValue(value.getDisplayName(), "")), Map.entry("websiteUrl", defaultValue(value.getWebsiteUrl(), "")),
                    Map.entry("industry", defaultValue(value.getIndustry(), "")), Map.entry("status", value.getBrandVerificationStatus().name())));
            jdbc.update("insert into organisation_brand_history (id, organisation_id, actor_id, actor_type, action, decision_note, snapshot_json, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), value.getId(), actorId, actorType, action, note, snapshot, Instant.now());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Company identity audit snapshot could not be created.", exception);
        }
    }

    private Recruiter recruiter(UUID id) { return recruiters.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter account was not found.")); }
    private Organisation organisation(UUID id) { return organisations.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organisation was not found.")); }
    private boolean isOrgAdmin(UUID id) { return memberRoles.findByRecruiter_Id(id).map(role -> role.getWorkspaceRole() == OrganisationWorkspaceRole.ORG_ADMIN).orElse(false); }
    private void requireOrgAdmin(UUID id) { if (!isOrgAdmin(id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only an organisation administrator can change company identity details."); }
    private String companyWebsite(String raw) { String value = httpsUrl(raw, "Company website"); URI uri = URI.create(value); return "https://" + normalizedHost(uri); }
    private String httpsUrl(String raw, String label) { String value = raw == null ? "" : raw.trim(); try { URI uri = URI.create(value); if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || uri.getPort() != -1) throw new IllegalArgumentException(); ensurePublicHost(uri.getHost()); return uri.toString(); } catch (IllegalArgumentException error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + " must be a public HTTPS address."); } }
    private String normalizedHost(URI uri) { return uri.getHost().toLowerCase(Locale.ROOT).replaceFirst("^www\\.", ""); }
    private boolean domainMatches(String emailDomain, String websiteHost) { String normalized = emailDomain.toLowerCase(Locale.ROOT).replaceFirst("^www\\.", ""); return normalized.equals(websiteHost) || normalized.endsWith("." + websiteHost) || websiteHost.endsWith("." + normalized); }
    private void ensurePublicHost(String rawHost) { String host = rawHost.toLowerCase(Locale.ROOT); if (host.equals("localhost") || host.endsWith(".local") || host.equals("0.0.0.0") || host.equals("127.0.0.1") || host.equals("::1") || host.matches("10\\..*") || host.matches("192\\.168\\..*") || host.matches("172\\.(1[6-9]|2[0-9]|3[01])\\..*")) throw new IllegalArgumentException(); }
    private String optionalHttpsUrl(String raw, String label) { return blank(raw) ? null : httpsUrl(raw, label); }
    private String blankToNull(String value) { return blank(value) ? null : value.trim(); }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    private String defaultValue(String value, String fallback) { return blank(value) ? fallback : value; }
    private String initials(String value) { return value.trim().split("\\s+").length == 1 ? value.substring(0, Math.min(2, value.length())).toUpperCase(Locale.ROOT) : java.util.Arrays.stream(value.trim().split("\\s+")).limit(2).map(part -> part.substring(0, 1).toUpperCase(Locale.ROOT)).reduce("", String::concat); }
    private void conflict(String message) { throw new ResponseStatusException(HttpStatus.CONFLICT, message); }
}

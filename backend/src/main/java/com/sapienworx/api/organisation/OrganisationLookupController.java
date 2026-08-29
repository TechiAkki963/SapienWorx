package com.sapienworx.api.organisation;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth/organisations")
@RequiredArgsConstructor
public class OrganisationLookupController {
    private final OrganisationRepository organisations;

    @GetMapping
    public List<OrganisationLookup> lookup(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String email
    ) {
        String normalized = query.trim();
        if (normalized.length() < 2) return List.of();
        String emailDomain = domain(email);
        return organisations.findTop8ByNameContainingIgnoreCaseOrderByName(normalized).stream()
                .map(organisation -> new OrganisationLookup(organisation.getId(), organisation.getName(),
                        maskedDomain(organisation.getWorkEmailDomain()), status(organisation.getWorkEmailDomain(), emailDomain)))
                .toList();
    }

    private String status(String organisationDomain, String emailDomain) {
        if (organisationDomain == null || organisationDomain.isBlank()) return "UNCLAIMED";
        if (emailDomain == null) return "EMAIL_REQUIRED";
        return organisationDomain.equalsIgnoreCase(emailDomain) ? "MATCH" : "MISMATCH";
    }

    private String domain(String email) {
        int separator = email == null ? -1 : email.lastIndexOf('@');
        return separator < 1 || separator == email.length() - 1 ? null : email.substring(separator + 1).trim().toLowerCase(Locale.ROOT);
    }

    private String maskedDomain(String domain) {
        if (domain == null || domain.isBlank()) return null;
        int dot = domain.indexOf('.');
        String stem = dot > 0 ? domain.substring(0, dot) : domain;
        return stem.substring(0, Math.min(2, stem.length())) + "•••" + (dot > 0 ? domain.substring(dot) : "");
    }

    public record OrganisationLookup(UUID id, String name, String workEmailDomain, String domainStatus) { }
}

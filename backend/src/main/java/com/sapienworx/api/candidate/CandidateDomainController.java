package com.sapienworx.api.candidate;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.PlatformRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/** Candidate-owned domain state; no candidate ID is accepted from the browser. */
@RestController
@RequestMapping("/api/candidate/domain")
@RequiredArgsConstructor
public class CandidateDomainController {

    private final CandidateDomainService candidateDomainService;

    @GetMapping
    public CandidateDomainResponse currentDomain(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            CsrfToken csrfToken
    ) {
        // Resolve the deferred token so CookieCsrfTokenRepository issues the
        // readable XSRF-TOKEN cookie required by the following PATCH request.
        csrfToken.getToken();
        return candidateDomainService.currentDomain(candidateId(currentUser));
    }

    @PatchMapping
    public CandidateDomainResponse resolveDomain(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @Valid @RequestBody ResolveCandidateDomainRequest request
    ) {
        return candidateDomainService.resolveDomain(candidateId(currentUser), request.domainCategory());
    }

    private UUID candidateId(AuthenticatedUser currentUser) {
        if (currentUser == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }
        if (currentUser.role() != PlatformRole.CANDIDATE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Candidate access is required.");
        }
        return currentUser.userId();
    }
}

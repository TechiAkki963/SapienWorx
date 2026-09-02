package com.sapienworx.api.organisation;

import com.sapienworx.api.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/organisation-brands")
@RequiredArgsConstructor
public class AdminOrganisationBrandController {
    private final OrganisationBrandService service;

    @GetMapping
    public List<OrganisationBrandResponse> profiles() { return service.adminProfiles(); }

    @PutMapping("/{organisationId}")
    public OrganisationBrandResponse update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID organisationId,
                                            @Valid @RequestBody OrganisationBrandRequests.Update request) {
        return service.updateByAdmin(user.userId(), organisationId, request);
    }

    @PostMapping("/{organisationId}/decision")
    public OrganisationBrandResponse decide(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID organisationId,
                                            @Valid @RequestBody OrganisationBrandRequests.Decision request) {
        return service.decide(user.userId(), organisationId, request);
    }
}

package com.sapienworx.api.organisation;

import com.sapienworx.api.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recruiter/organisation-brand")
@RequiredArgsConstructor
public class OrganisationBrandController {
    private final OrganisationBrandService service;

    @GetMapping
    public OrganisationBrandResponse profile(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.recruiterProfile(user.userId());
    }

    @PutMapping
    public OrganisationBrandResponse update(@AuthenticationPrincipal AuthenticatedUser user,
                                            @Valid @RequestBody OrganisationBrandRequests.Update request) {
        return service.updateByRecruiter(user.userId(), request);
    }
}

package com.sapienworx.api.workflow;

import com.sapienworx.api.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/recruiter/talent-crm")
@RequiredArgsConstructor
public class TalentCrmController {
    private final TalentCrmService talentCrm;

    @GetMapping("/rediscovery")
    public WorkflowResponses.RediscoveryWorkspace rediscovery(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "20") int limit) {
        return talentCrm.rediscovery(recruiterId(user), query, limit);
    }

    private UUID recruiterId(AuthenticatedUser user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        return user.userId();
    }
}

package com.sapienworx.api.candidate;

import com.sapienworx.api.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/candidate")
@RequiredArgsConstructor
public class CandidateWorkspaceController {
    private final CandidateWorkspaceService candidateWorkspaceService;

    @GetMapping("/profile")
    public CandidateProfileResponse profile(@AuthenticationPrincipal AuthenticatedUser user) { return candidateWorkspaceService.profile(candidateId(user)); }
    @PatchMapping("/profile")
    public CandidateProfileResponse updateProfile(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody CandidateProfileRequest request) { return candidateWorkspaceService.updateProfile(candidateId(user), request); }
    @PostMapping("/jobs/{publicJobId}/applications")
    public CandidateApplicationResponse apply(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId, @Valid @RequestBody CandidateApplicationRequest request) { return candidateWorkspaceService.apply(candidateId(user), publicJobId, request); }
    @GetMapping("/applications")
    public Page<CandidateApplicationResponse> applications(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam(defaultValue = "0") int page) { return candidateWorkspaceService.applications(candidateId(user), PageRequest.of(Math.max(0, page), 10)); }
    @DeleteMapping("/account")
    public void eraseAccount(@AuthenticationPrincipal AuthenticatedUser user) { candidateWorkspaceService.erase(candidateId(user)); }

    private UUID candidateId(AuthenticatedUser user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        return user.userId();
    }
}

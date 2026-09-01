package com.sapienworx.api.job;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.web.ApiPageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
@RequestMapping("/api/recruiter/jobs")
@RequiredArgsConstructor
public class RecruiterJobController {
    private final RecruiterJobService recruiterJobService;

    @PostMapping
    public JobResponse createDraft(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody JobUpsertRequest request) {
        return recruiterJobService.createDraft(recruiterId(user), request);
    }
    @GetMapping
    public ApiPageResponse<RecruiterManagedJobResponse> list(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam(required = false) JobStatus status,
                                                  @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiPageResponse.from(recruiterJobService.list(recruiterId(user), status, PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)))));
    }
    @GetMapping("/{publicJobId}")
    public JobResponse details(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId) { return recruiterJobService.details(recruiterId(user), publicJobId); }
    @GetMapping("/{publicJobId}/workspace")
    public RecruiterJobWorkspaceResponse workspace(@AuthenticationPrincipal AuthenticatedUser user,
                                                    @PathVariable String publicJobId,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "20") int size) {
        return recruiterJobService.workspace(recruiterId(user), publicJobId,
                PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 50))));
    }
    @PatchMapping("/{publicJobId}")
    public JobResponse update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId, @Valid @RequestBody JobUpsertRequest request) { return recruiterJobService.update(recruiterId(user), publicJobId, request); }
    @PostMapping("/{publicJobId}/publish")
    public JobResponse publish(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId) {
        return recruiterJobService.publish(recruiterId(user), publicJobId);
    }
    @PostMapping("/{publicJobId}/duplicate")
    public JobResponse duplicate(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId) { return recruiterJobService.duplicate(recruiterId(user), publicJobId); }
    @PostMapping("/{publicJobId}/status/{status}")
    public JobResponse changeStatus(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId, @PathVariable JobStatus status) { return recruiterJobService.changeStatus(recruiterId(user), publicJobId, status); }
    @GetMapping("/{publicJobId}/share")
    public JobShareResponse share(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String publicJobId) { return recruiterJobService.share(recruiterId(user), publicJobId); }

    private UUID recruiterId(AuthenticatedUser user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        return user.userId();
    }
}

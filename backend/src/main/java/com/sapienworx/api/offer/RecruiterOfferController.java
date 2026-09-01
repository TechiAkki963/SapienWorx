package com.sapienworx.api.offer;

import com.sapienworx.api.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/recruiter/applications/{applicationId}/offer")
@RequiredArgsConstructor
public class RecruiterOfferController {
    private final OfferService offers;

    @GetMapping public OfferResponses.RecruiterWorkspace workspace(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId) {
        return offers.recruiterWorkspace(recruiterId(user), applicationId);
    }
    @PutMapping public OfferResponses.RecruiterWorkspace save(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId,
                                                               @Valid @RequestBody OfferRequests.Draft request) {
        return offers.saveDraft(recruiterId(user), applicationId, request);
    }
    @PostMapping("/submit") public OfferResponses.RecruiterWorkspace submit(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId,
                                                                              @Valid @RequestBody OfferRequests.VersionAction request) {
        return offers.submit(recruiterId(user), applicationId, request.expectedVersion());
    }
    @PostMapping("/approval") public OfferResponses.RecruiterWorkspace approval(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId,
                                                                                  @Valid @RequestBody OfferRequests.Approval request) {
        return offers.decide(recruiterId(user), applicationId, request);
    }
    @PostMapping("/send") public OfferResponses.RecruiterWorkspace send(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId,
                                                                          @Valid @RequestBody OfferRequests.VersionAction request) {
        return offers.send(recruiterId(user), applicationId, request.expectedVersion());
    }
    @PostMapping("/withdraw") public OfferResponses.RecruiterWorkspace withdraw(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId,
                                                                                  @Valid @RequestBody OfferRequests.VersionAction request) {
        return offers.withdraw(recruiterId(user), applicationId, request.expectedVersion());
    }
    @GetMapping(value = "/document.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> document(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId) {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=sapienworx-offer.pdf")
                .contentType(MediaType.APPLICATION_PDF).body(offers.recruiterDocument(recruiterId(user), applicationId));
    }
    private UUID recruiterId(AuthenticatedUser user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        return user.userId();
    }
}

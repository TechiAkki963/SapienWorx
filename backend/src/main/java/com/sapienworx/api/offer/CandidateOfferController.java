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
@RequestMapping("/api/candidate/applications/{applicationId}/offer")
@RequiredArgsConstructor
public class CandidateOfferController {
    private final OfferService offers;

    @GetMapping public OfferResponses.CandidateWorkspace workspace(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId) {
        return offers.candidateWorkspace(candidateId(user), applicationId);
    }
    @PostMapping("/response") public OfferResponses.CandidateWorkspace respond(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId,
                                                                                  @Valid @RequestBody OfferRequests.CandidateResponse request) {
        return offers.respond(candidateId(user), applicationId, request);
    }
    @GetMapping(value = "/document.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> document(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID applicationId) {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=sapienworx-offer.pdf")
                .contentType(MediaType.APPLICATION_PDF).body(offers.candidateDocument(candidateId(user), applicationId));
    }
    private UUID candidateId(AuthenticatedUser user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        return user.userId();
    }
}

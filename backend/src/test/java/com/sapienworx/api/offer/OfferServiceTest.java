package com.sapienworx.api.offer;

import com.sapienworx.api.application.*;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.job.*;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.recruiter.*;
import com.sapienworx.api.workflow.ApplicationEventService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OfferServiceTest {
    private final OfferRepository offers = mock(OfferRepository.class);
    private final OfferVersionRepository versions = mock(OfferVersionRepository.class);
    private final OfferApprovalRepository approvals = mock(OfferApprovalRepository.class);
    private final JobApplicationRepository applications = mock(JobApplicationRepository.class);
    private final RecruiterRepository recruiters = mock(RecruiterRepository.class);
    private final OrganisationOfferPolicy policy = mock(OrganisationOfferPolicy.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final ApplicationEventService events = mock(ApplicationEventService.class);
    private final OfferPdfRenderer pdf = mock(OfferPdfRenderer.class);
    private final Organisation organisation = Organisation.builder().id(UUID.randomUUID()).name("Sapienworx QA").initials("SWX").build();
    private final Recruiter owner = Recruiter.builder().id(UUID.randomUUID()).fullName("Alex Recruiter")
            .officialEmail("alex@sapienworx.qa").organisation(organisation).build();
    private final Recruiter approver = Recruiter.builder().id(UUID.randomUUID()).fullName("Sam Recruiter")
            .officialEmail("sam@sapienworx.qa").organisation(organisation).build();
    private final Candidate candidate = Candidate.builder().id(UUID.randomUUID()).fullName("Taylor Tech")
            .email("taylor@sapienworx.qa").mobile("+919000000021").build();
    private JobApplication application;
    private OfferService service;

    @BeforeEach
    void setUp() {
        Job job = Job.builder().internalId(UUID.randomUUID()).publicJobId("SWX_QA_901").title("Platform Engineer")
                .department("Engineering").employmentType(EmploymentType.FULL_TIME).workplaceModel(WorkplaceModel.HYBRID)
                .location("Bengaluru").minimumExperienceYears(3).maximumExperienceYears(6).organisation(organisation)
                .createdByRecruiter(owner).build();
        application = JobApplication.builder().id(UUID.randomUUID()).job(job).candidate(candidate).recipientRecruiter(owner)
                .pipelineStage(PipelineStage.OFFER).applicationSource(ApplicationSource.DIRECT).build();
        service = new OfferService(offers, versions, approvals, applications, recruiters, policy, notifications, events, pdf);
        when(recruiters.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(recruiters.findById(approver.getId())).thenReturn(Optional.of(approver));
        when(applications.findById(application.getId())).thenReturn(Optional.of(application));
        when(policy.entitlement(organisation.getId())).thenReturn(new OfferResponses.Entitlement("GROWTH", 3, true, false, false));
        when(approvals.findByOffer_IdAndVersionNumberOrderByCreatedAtAsc(any(), anyInt())).thenReturn(List.of());
        when(versions.findByOffer_IdOrderByVersionNumberDesc(any())).thenReturn(List.of());
        when(offers.save(any())).thenAnswer(invocation -> {
            Offer value = invocation.getArgument(0);
            if (value.getId() == null) value.setId(UUID.randomUUID());
            return value;
        });
    }

    @Test
    void savesImmutableDraftVersionWithTenantScopedApproval() {
        when(offers.findByApplication_Id(application.getId())).thenReturn(Optional.empty());
        when(recruiters.findAllById(List.of(approver.getId()))).thenReturn(List.of(approver));

        OfferResponses.RecruiterWorkspace result = service.saveDraft(owner.getId(), application.getId(), draft(null, List.of(approver.getId())));

        assertThat(result.offer()).isNotNull();
        assertThat(result.offer().status()).isEqualTo(OfferStatus.DRAFT);
        assertThat(result.offer().version()).isEqualTo(1);
        verify(versions).save(argThat(version -> version.getVersionNumber() == 1 && version.getDesignation().equals("Platform Engineer")));
        verify(approvals).save(argThat(approval -> approval.getApproverRecruiter().getId().equals(approver.getId())));
        verify(events).record(eq(application), eq("RECRUITER"), eq("OFFER_DRAFT_CREATED"), contains("version 1"));
    }

    @Test
    void rejectsStaleDraftUpdatesBeforeChangingTheOffer() {
        Offer existing = offer(OfferStatus.DRAFT, 2);
        when(offers.findByApplication_Id(application.getId())).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.saveDraft(owner.getId(), application.getId(), draft(1, List.of())))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("newer offer version");
        verify(versions, never()).save(any());
    }

    @Test
    void autoApprovesCoreOfferThenSendsItToCandidate() {
        Offer offer = offer(OfferStatus.DRAFT, 1);
        when(offers.findByApplication_Id(application.getId())).thenReturn(Optional.of(offer));

        OfferResponses.RecruiterWorkspace approved = service.submit(owner.getId(), application.getId(), 1);
        assertThat(approved.offer().status()).isEqualTo(OfferStatus.APPROVED);

        OfferResponses.RecruiterWorkspace sent = service.send(owner.getId(), application.getId(), 1);
        assertThat(sent.offer().status()).isEqualTo(OfferStatus.SENT);
        assertThat(sent.offer().sentAt()).isNotNull();
        verify(notifications).create(eq(candidate.getId()), eq("OFFER_SENT"), anyString(), anyString(), eq("APPLICATION"), eq(application.getId()));
    }

    @Test
    void candidateResponseIsVersionCheckedAndCannotBeSubmittedTwice() {
        Offer offer = offer(OfferStatus.SENT, 3);
        when(offers.findByApplication_IdAndApplication_Candidate_Id(application.getId(), candidate.getId())).thenReturn(Optional.of(offer));

        assertThatThrownBy(() -> service.respond(candidate.getId(), application.getId(),
                new OfferRequests.CandidateResponse(2, OfferRequests.CandidateDecision.ACCEPT, "Excited to join.")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("newer offer version");

        OfferResponses.CandidateWorkspace accepted = service.respond(candidate.getId(), application.getId(),
                new OfferRequests.CandidateResponse(3, OfferRequests.CandidateDecision.ACCEPT, "Excited to join."));
        assertThat(accepted.offer().status()).isEqualTo(OfferStatus.ACCEPTED);
        assertThat(accepted.offer().responseNote()).isEqualTo("Excited to join.");
        assertThatThrownBy(() -> service.respond(candidate.getId(), application.getId(),
                new OfferRequests.CandidateResponse(3, OfferRequests.CandidateDecision.ACCEPT, null)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("no longer awaiting");
    }

    @Test
    void blocksCrossOrganisationApproversAndHiringWithoutAcceptance() {
        Organisation other = Organisation.builder().id(UUID.randomUUID()).name("Other").initials("OTH").build();
        Recruiter outsider = Recruiter.builder().id(UUID.randomUUID()).fullName("Outside Approver").officialEmail("outside@example.test").organisation(other).build();
        when(offers.findByApplication_Id(application.getId())).thenReturn(Optional.empty());
        when(recruiters.findAllById(List.of(outsider.getId()))).thenReturn(List.of(outsider));

        assertThatThrownBy(() -> service.saveDraft(owner.getId(), application.getId(), draft(null, List.of(outsider.getId()))))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("must belong to your organisation");
        assertThat(service.hasAcceptedOffer(application.getId())).isFalse();
    }

    private OfferRequests.Draft draft(Integer expectedVersion, List<UUID> approvers) {
        return new OfferRequests.Draft(expectedVersion, "Platform Engineer", LocalDate.now().plusDays(14), WorkplaceModel.HYBRID,
                6, true, Instant.now().plusSeconds(3 * 86_400), "INR", new BigDecimal("1800000"), new BigDecimal("200000"),
                BigDecimal.ZERO, BigDecimal.ZERO, "Health cover", "We would be delighted to have you join us.",
                "Subject to successful joining checks.", approvers);
    }

    private Offer offer(OfferStatus status, int version) {
        return Offer.builder().id(UUID.randomUUID()).application(application).organisation(organisation).createdByRecruiter(owner)
                .status(status).currentVersion(version).designation("Platform Engineer").joiningDate(LocalDate.now().plusDays(14))
                .workplaceModel(WorkplaceModel.HYBRID).probationMonths(6).noticeBuyout(true).expiresAt(Instant.now().plusSeconds(3 * 86_400))
                .currency("INR").annualFixedAmount(new BigDecimal("1800000")).annualVariableAmount(new BigDecimal("200000"))
                .joiningBonus(BigDecimal.ZERO).retentionBonus(BigDecimal.ZERO).otherCompensation("Health cover")
                .candidateMessage("We would be delighted to have you join us.").termsText("Subject to joining checks.").build();
    }
}

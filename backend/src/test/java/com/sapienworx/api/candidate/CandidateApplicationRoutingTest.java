package com.sapienworx.api.candidate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.admin.PlatformPrivacyCaseRepository;
import com.sapienworx.api.application.ApplicationSource;
import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.communication.DirectMessageRepository;
import com.sapienworx.api.interview.InterviewRepository;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.recruiter.CandidateProfileEngagementRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.workflow.ApplicationEventRepository;
import com.sapienworx.api.workflow.ApplicationEventService;
import com.sapienworx.api.workflow.CandidateContactPreferenceRepository;
import com.sapienworx.api.workflow.JobReferral;
import com.sapienworx.api.workflow.JobReferralRepository;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CandidateApplicationRoutingTest {

    @Test
    void routesEverySocialApplicationToTheRecruiterWhoPostedTheJob() {
        Harness harness = new Harness();
        Fixture fixture = harness.activeFixture();
        harness.persistApplications();

        harness.service.apply(fixture.candidate().getId(), fixture.job().getPublicJobId(),
                new CandidateApplicationRequest(null, null, "linkedin"));

        org.mockito.ArgumentCaptor<JobApplication> saved = org.mockito.ArgumentCaptor.forClass(JobApplication.class);
        verify(harness.applications).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getRecipientRecruiter()).isSameAs(fixture.owner());
        assertThat(saved.getValue().getApplicationSource()).isEqualTo(ApplicationSource.LINKEDIN);
        assertThat(saved.getValue().getReferral()).isNull();
        verify(harness.notifications).create(eq(fixture.owner().getId()), eq("NEW_APPLICATION"),
                eq("New application for Senior Backend Engineer"), eq("Shared-link candidate has applied."),
                eq("APPLICATION"), nullable(UUID.class));
    }

    @Test
    void validCandidateReferralAddsAttributionWithoutChangingTheRecipient() {
        Harness harness = new Harness();
        Fixture fixture = harness.activeFixture();
        Candidate referrer = Candidate.builder().id(UUID.randomUUID()).fullName("Referrer").build();
        JobReferral referral = JobReferral.builder().id(UUID.randomUUID()).job(fixture.job())
                .referrerCandidate(referrer).referralCode("SWX-VALID").build();
        when(harness.referrals.findByReferralCode("SWX-VALID")).thenReturn(Optional.of(referral));
        harness.persistApplications();

        harness.service.apply(fixture.candidate().getId(), fixture.job().getPublicJobId(),
                new CandidateApplicationRequest(null, "swx-valid", "whatsapp"));

        org.mockito.ArgumentCaptor<JobApplication> saved = org.mockito.ArgumentCaptor.forClass(JobApplication.class);
        verify(harness.applications).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getRecipientRecruiter()).isSameAs(fixture.owner());
        assertThat(saved.getValue().getReferral()).isSameAs(referral);
        assertThat(saved.getValue().getApplicationSource()).isEqualTo(ApplicationSource.CANDIDATE_SHARE);
        assertThat(referral.getApplicantCandidate()).isSameAs(fixture.candidate());
    }

    @Test
    void aReferralForAnotherJobCannotRedirectOrClaimTheApplication() {
        Harness harness = new Harness();
        Fixture fixture = harness.activeFixture();
        Job anotherJob = Job.builder().internalId(UUID.randomUUID()).publicJobId("SWX_OTHER_001")
                .organisation(fixture.organisation()).createdByRecruiter(fixture.owner()).status(JobStatus.ACTIVE).build();
        JobReferral wrongReferral = JobReferral.builder().id(UUID.randomUUID()).job(anotherJob)
                .referralCode("SWX-WRONG-JOB").build();
        when(harness.referrals.findByReferralCode("SWX-WRONG-JOB")).thenReturn(Optional.of(wrongReferral));
        harness.persistApplications();

        harness.service.apply(fixture.candidate().getId(), fixture.job().getPublicJobId(),
                new CandidateApplicationRequest(null, "SWX-WRONG-JOB", "whatsapp"));

        org.mockito.ArgumentCaptor<JobApplication> saved = org.mockito.ArgumentCaptor.forClass(JobApplication.class);
        verify(harness.applications).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getRecipientRecruiter()).isSameAs(fixture.owner());
        assertThat(saved.getValue().getReferral()).isNull();
        assertThat(saved.getValue().getApplicationSource()).isEqualTo(ApplicationSource.WHATSAPP);
        assertThat(wrongReferral.getApplicantCandidate()).isNull();
    }

    @Test
    void closedJobsAndDeletionPendingAccountsCannotAcceptApplications() {
        Harness closedHarness = new Harness();
        Fixture closed = closedHarness.activeFixture();
        closed.job().setStatus(JobStatus.CLOSED);

        assertThatThrownBy(() -> closedHarness.service.apply(closed.candidate().getId(), closed.job().getPublicJobId(),
                new CandidateApplicationRequest(null, null, "x")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(closedHarness.applications, never()).saveAndFlush(any());

        Harness deletionHarness = new Harness();
        Fixture deletion = deletionHarness.activeFixture();
        deletion.candidate().setDeletionRequested(true);
        assertThatThrownBy(() -> deletionHarness.service.apply(deletion.candidate().getId(), deletion.job().getPublicJobId(),
                new CandidateApplicationRequest(null, null, "x")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(deletionHarness.applications, never()).saveAndFlush(any());
    }

    @Test
    void ownershipMismatchAndDuplicateRacesFailWithoutNotifyingTheWrongRecruiter() {
        Harness ownerHarness = new Harness();
        Fixture ownership = ownerHarness.activeFixture();
        Organisation other = Organisation.builder().id(UUID.randomUUID()).name("Other org").initials("OT").build();
        ownership.owner().setOrganisation(other);
        assertThatThrownBy(() -> ownerHarness.service.apply(ownership.candidate().getId(), ownership.job().getPublicJobId(),
                new CandidateApplicationRequest(null, null, "copy_link")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(ownerHarness.notifications, never()).create(any(), any(), any(), any(), any(), any());

        Harness raceHarness = new Harness();
        Fixture race = raceHarness.activeFixture();
        when(raceHarness.applications.saveAndFlush(any(JobApplication.class)))
                .thenThrow(new DataIntegrityViolationException("unique candidate/job"));
        assertThatThrownBy(() -> raceHarness.service.apply(race.candidate().getId(), race.job().getPublicJobId(),
                new CandidateApplicationRequest(null, null, "copy_link")))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(error.getReason()).contains("already applied");
                });
        verify(raceHarness.notifications, never()).create(any(), any(), any(), any(), any(), any());
    }

    @Test
    void savesPublishedJobsForTheAuthenticatedCandidateAndRemovesThemIdempotently() {
        Harness harness = new Harness();
        Fixture fixture = harness.activeFixture();
        when(harness.savedJobs.findByCandidate_IdAndJob_InternalId(fixture.candidate().getId(), fixture.job().getInternalId()))
                .thenReturn(Optional.empty());
        when(harness.savedJobs.saveAndFlush(any(SavedJob.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SavedJobResponse saved = harness.service.saveJob(fixture.candidate().getId(), fixture.job().getPublicJobId());

        assertThat(saved.jobId()).isEqualTo(fixture.job().getPublicJobId());
        verify(harness.savedJobs).saveAndFlush(any(SavedJob.class));

        harness.service.removeSavedJob(fixture.candidate().getId(), fixture.job().getPublicJobId());
        verify(harness.savedJobs).deleteByCandidate_IdAndJob_InternalId(fixture.candidate().getId(), fixture.job().getInternalId());
    }

    private record Fixture(Candidate candidate, Recruiter owner, Organisation organisation, Job job) { }

    private static final class Harness {
        private final CandidateRepository candidates = mock(CandidateRepository.class);
        private final JobRepository jobs = mock(JobRepository.class);
        private final JobApplicationRepository applications = mock(JobApplicationRepository.class);
        private final NotificationService notifications = mock(NotificationService.class);
        private final JobReferralRepository referrals = mock(JobReferralRepository.class);
        private final SavedJobRepository savedJobs = mock(SavedJobRepository.class);
        private final CandidateWorkspaceService service = new CandidateWorkspaceService(candidates, jobs, applications,
                mock(CandidateProfileEngagementRepository.class), notifications, mock(DirectMessageRepository.class), new ObjectMapper(),
                mock(ApplicationEventService.class), mock(ApplicationEventRepository.class), mock(InterviewRepository.class),
                mock(CandidateContactPreferenceRepository.class), referrals, mock(PlatformPrivacyCaseRepository.class),
                savedJobs, mock(com.sapienworx.api.cvparser.CandidateParseResultRepository.class),
                mock(com.sapienworx.api.cvparser.CvDocumentStorage.class),
                mock(com.sapienworx.api.admin.PrivacyConsentEvidenceRepository.class));

        private Fixture activeFixture() {
            UUID candidateId = UUID.randomUUID();
            Organisation organisation = Organisation.builder().id(UUID.randomUUID()).name("Nexora Cloud").initials("NX").build();
            Candidate candidate = Candidate.builder().id(candidateId).fullName("Shared-link candidate").build();
            Recruiter owner = Recruiter.builder().id(UUID.randomUUID()).fullName("Nexora Hiring")
                    .officialEmail("hiring.nx@example.test").organisation(organisation).build();
            Job job = Job.builder().internalId(UUID.randomUUID()).publicJobId("SWX_NX_001").title("Senior Backend Engineer")
                    .organisation(organisation).createdByRecruiter(owner).status(JobStatus.ACTIVE).build();
            when(candidates.findById(candidateId)).thenReturn(Optional.of(candidate));
            when(jobs.findByPublicJobId(job.getPublicJobId())).thenReturn(Optional.of(job));
            when(applications.existsByCandidate_IdAndJob_InternalId(candidateId, job.getInternalId())).thenReturn(false);
            return new Fixture(candidate, owner, organisation, job);
        }

        private void persistApplications() {
            when(applications.saveAndFlush(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        }
    }
}

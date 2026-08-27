package com.sapienworx.api.candidate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.recruiter.CandidateProfileEngagementRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.communication.DirectMessageRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CandidateApplicationRoutingTest {

    @Test
    void sendsAnApplicationFromAnyJobLinkOnlyToThatJobsPostingRecruiter() {
        CandidateRepository candidates = mock(CandidateRepository.class);
        JobRepository jobs = mock(JobRepository.class);
        JobApplicationRepository applications = mock(JobApplicationRepository.class);
        CandidateProfileEngagementRepository engagement = mock(CandidateProfileEngagementRepository.class);
        NotificationService notifications = mock(NotificationService.class);
        DirectMessageRepository messages = mock(DirectMessageRepository.class);
        CandidateWorkspaceService service = new CandidateWorkspaceService(candidates, jobs, applications, engagement, notifications, messages, new ObjectMapper());

        UUID candidateId = UUID.randomUUID();
        UUID recruiterId = UUID.randomUUID();
        Organisation organisation = Organisation.builder().id(UUID.randomUUID()).name("Nexora Cloud").initials("NX").build();
        Candidate candidate = Candidate.builder().id(candidateId).fullName("Shared-link candidate").build();
        Recruiter owner = Recruiter.builder().id(recruiterId).fullName("Nexora Hiring").officialEmail("hiring.nx@example.test").organisation(organisation).build();
        Job job = Job.builder().internalId(UUID.randomUUID()).publicJobId("SWX_NX_001").title("Senior Backend Engineer")
                .organisation(organisation).createdByRecruiter(owner).status(JobStatus.ACTIVE).build();

        when(candidates.findById(candidateId)).thenReturn(Optional.of(candidate));
        when(jobs.findByPublicJobId("SWX_NX_001")).thenReturn(Optional.of(job));
        when(applications.existsByCandidate_IdAndJob_InternalId(candidateId, job.getInternalId())).thenReturn(false);
        when(applications.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.apply(candidateId, "SWX_NX_001", new CandidateApplicationRequest(null));

        org.mockito.ArgumentCaptor<JobApplication> application = org.mockito.ArgumentCaptor.forClass(JobApplication.class);
        verify(applications).save(application.capture());
        assertThat(application.getValue().getRecipientRecruiter()).isSameAs(owner);
        verify(notifications).create(eq(recruiterId), eq("NEW_APPLICATION"), eq("New application for Senior Backend Engineer"),
                eq("Shared-link candidate has applied."), eq("APPLICATION"), any());
    }
}

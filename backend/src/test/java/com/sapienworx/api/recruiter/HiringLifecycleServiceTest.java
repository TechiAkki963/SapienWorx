package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.offer.OfferService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HiringLifecycleServiceTest {
    private final RecruiterOperationsService operations = mock(RecruiterOperationsService.class);
    private final RecruiterRepository recruiters = mock(RecruiterRepository.class);
    private final JobApplicationRepository applications = mock(JobApplicationRepository.class);
    private final OfferService offers = mock(OfferService.class);

    private final UUID recruiterId = UUID.randomUUID();
    private final UUID applicationId = UUID.randomUUID();
    private final Recruiter recruiter = Recruiter.builder().id(recruiterId).fullName("Alex Recruiter").build();
    private HiringLifecycleService service;

    @BeforeEach
    void setUp() {
        service = new HiringLifecycleService(operations, recruiters, applications, offers);
        when(recruiters.findById(recruiterId)).thenReturn(Optional.of(recruiter));
    }

    @Test
    void schedulingFirstInterviewAdvancesAppliedCandidateToInterviewing() {
        JobApplication application = application(PipelineStage.APPLIED);
        InterviewRequest request = interviewRequest();
        RecruiterDashboardResponse.UpcomingInterview scheduled = upcomingInterview();
        when(applications.findById(applicationId)).thenReturn(Optional.of(application));
        when(operations.schedule(recruiterId, request)).thenReturn(scheduled);

        RecruiterDashboardResponse.UpcomingInterview result = service.scheduleInterview(recruiterId, request);

        assertThat(result).isSameAs(scheduled);
        verify(operations).moveStage(recruiterId, applicationId, PipelineStage.INTERVIEWING);
    }

    @Test
    void schedulingInterviewAdvancesScreeningCandidateToInterviewing() {
        JobApplication application = application(PipelineStage.SCREENING);
        InterviewRequest request = interviewRequest();
        when(applications.findById(applicationId)).thenReturn(Optional.of(application));
        when(operations.schedule(recruiterId, request)).thenReturn(upcomingInterview());

        service.scheduleInterview(recruiterId, request);

        verify(operations).moveStage(recruiterId, applicationId, PipelineStage.INTERVIEWING);
    }

    @Test
    void schedulingAdditionalInterviewDoesNotMoveFinalStageCandidateBackwards() {
        JobApplication application = application(PipelineStage.FINAL_STAGE);
        InterviewRequest request = interviewRequest();
        when(applications.findById(applicationId)).thenReturn(Optional.of(application));
        when(operations.schedule(recruiterId, request)).thenReturn(upcomingInterview());

        service.scheduleInterview(recruiterId, request);

        verify(operations, never()).moveStage(recruiterId, applicationId, PipelineStage.INTERVIEWING);
    }

    @Test
    void acceptedOfferCannotMoveBackIntoEarlierHiringStage() {
        JobApplication application = application(PipelineStage.OFFER);
        when(applications.findById(applicationId)).thenReturn(Optional.of(application));
        when(offers.hasAcceptedOffer(applicationId)).thenReturn(true);

        assertThatThrownBy(() -> service.moveStage(recruiterId, applicationId, PipelineStage.SCREENING))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("accepted the offer");

        verify(operations, never()).moveStage(recruiterId, applicationId, PipelineStage.SCREENING);
    }

    @Test
    void acceptedOfferCanProgressToHired() {
        JobApplication application = application(PipelineStage.OFFER);
        PipelineCandidateResponse response = mock(PipelineCandidateResponse.class);
        when(applications.findById(applicationId)).thenReturn(Optional.of(application));
        when(offers.hasAcceptedOffer(applicationId)).thenReturn(true);
        when(operations.moveStage(recruiterId, applicationId, PipelineStage.ONBOARDED)).thenReturn(response);

        assertThat(service.moveStage(recruiterId, applicationId, PipelineStage.ONBOARDED)).isSameAs(response);
        verify(operations).moveStage(recruiterId, applicationId, PipelineStage.ONBOARDED);
    }

    @Test
    void hiredApplicationIsTerminal() {
        JobApplication application = application(PipelineStage.ONBOARDED);
        when(applications.findById(applicationId)).thenReturn(Optional.of(application));

        assertThatThrownBy(() -> service.moveStage(recruiterId, applicationId, PipelineStage.FINAL_STAGE))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("cannot be moved back");

        verify(operations, never()).moveStage(recruiterId, applicationId, PipelineStage.FINAL_STAGE);
    }

    private JobApplication application(PipelineStage stage) {
        return JobApplication.builder()
                .id(applicationId)
                .recipientRecruiter(recruiter)
                .pipelineStage(stage)
                .build();
    }

    private InterviewRequest interviewRequest() {
        return new InterviewRequest(applicationId, "Google Meet", "https://meet.google.com/example",
                Instant.now().plusSeconds(3600), 45, "Asia/Kolkata", "Technical interview", List.of());
    }

    private RecruiterDashboardResponse.UpcomingInterview upcomingInterview() {
        return new RecruiterDashboardResponse.UpcomingInterview("Candidate", "Backend Engineer", "Google Meet",
                "https://meet.google.com/example", Instant.now().plusSeconds(3600), 45);
    }
}

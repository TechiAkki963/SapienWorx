package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.ApplicationSource;
import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.application.RecruiterNote;
import com.sapienworx.api.application.RecruiterNoteRepository;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateEducation;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.candidate.CandidateSourcingService;
import com.sapienworx.api.candidate.EducationLevel;
import com.sapienworx.api.cvparser.CandidateParseResultRepository;
import com.sapienworx.api.events.SseNotificationService;
import com.sapienworx.api.interview.InterviewRepository;
import com.sapienworx.api.interview.Interview;
import com.sapienworx.api.interview.InterviewStatus;
import com.sapienworx.api.job.EmploymentType;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.job.WorkplaceModel;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.offer.OfferService;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.recruiter.RecruiterJobApplicantDetailResponse;
import com.sapienworx.api.taxonomy.DomainCategory;
import com.sapienworx.api.workflow.ApplicationEventService;
import com.sapienworx.api.workflow.ApplicationEventRepository;
import com.sapienworx.api.workflow.InterviewScorecardRepository;
import com.sapienworx.api.workflow.InterviewScorecard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.contains;

class RecruiterOperationsServiceTest {
    private final RecruiterRepository recruiters = mock(RecruiterRepository.class);
    private final JobRepository jobs = mock(JobRepository.class);
    private final JobApplicationRepository applications = mock(JobApplicationRepository.class);
    private final RecruiterNoteRepository notes = mock(RecruiterNoteRepository.class);
    private final CandidateSourcingService sourcing = mock(CandidateSourcingService.class);
    private final CandidateRepository candidates = mock(CandidateRepository.class);
    private final CandidateProfileEngagementRepository engagement = mock(CandidateProfileEngagementRepository.class);
    private final CandidateParseResultRepository parses = mock(CandidateParseResultRepository.class);
    private final InterviewRepository interviews = mock(InterviewRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final SseNotificationService events = mock(SseNotificationService.class);
    private final ApplicationEventService applicationEvents = mock(ApplicationEventService.class);
    private final ApplicationEventRepository applicationEventRepository = mock(ApplicationEventRepository.class);
    private final InterviewScorecardRepository scorecards = mock(InterviewScorecardRepository.class);
    private final OfferService offers = mock(OfferService.class);
    private final Organisation organisation = Organisation.builder().id(UUID.randomUUID()).name("Nexora").initials("NX").build();
    private final Recruiter recruiter = Recruiter.builder().id(UUID.randomUUID()).fullName("Alex Recruiter")
            .officialEmail("alex@nexora.test").organisation(organisation).build();
    private RecruiterOperationsService service;

    @BeforeEach
    void setUp() {
        service = new RecruiterOperationsService(recruiters, jobs, applications, notes, sourcing, candidates, engagement,
                parses, interviews, notifications, events, applicationEvents, applicationEventRepository, scorecards, offers);
        when(recruiters.findById(recruiter.getId())).thenReturn(Optional.of(recruiter));
    }

    @Test
    void applicantWorkspaceRequiresTheExactJobAndPostingRecruiter() {
        Job job = Job.builder().internalId(UUID.randomUUID()).publicJobId("SWX_NX_201").title("Product Lead")
                .department("Product").employmentType(EmploymentType.FULL_TIME).workplaceModel(WorkplaceModel.HYBRID)
                .location("Bengaluru").minimumExperienceYears(5).maximumExperienceYears(8).skills(new LinkedHashSet<>())
                .status(JobStatus.ACTIVE).organisation(organisation).createdByRecruiter(recruiter).build();
        Candidate candidate = Candidate.builder().id(UUID.randomUUID()).fullName("Mira Rao").email("mira@example.test")
                .mobile("+919800000001").headline("Product design leader").currentCompany("Northstar")
                .preferredLocations(List.of("Bengaluru", "Remote")).workLinks(List.of("https://portfolio.example.test"))
                .education(new LinkedHashSet<>()).skills(new LinkedHashSet<>()).build();
        CandidateEducation education = CandidateEducation.builder().candidate(candidate).level(EducationLevel.MASTERS)
                .degreeName("M.Des").institutionName("NID").graduationYear(2021).build();
        candidate.setEducation(new LinkedHashSet<>(Set.of(education)));
        JobApplication application = JobApplication.builder().id(UUID.randomUUID()).job(job).candidate(candidate)
                .recipientRecruiter(recruiter).pipelineStage(PipelineStage.SCREENING).applicationSource(ApplicationSource.DIRECT)
                .appliedAt(Instant.parse("2026-08-29T08:00:00Z")).updatedAt(Instant.parse("2026-08-30T08:00:00Z")).build();
        RecruiterNote note = RecruiterNote.builder().application(application).recruiter(recruiter).noteText("Strong portfolio evidence.")
                .updatedAt(Instant.parse("2026-08-30T09:00:00Z")).build();
        when(applications.findById(application.getId())).thenReturn(Optional.of(application));
        when(notes.findTop10ByApplication_IdOrderByUpdatedAtDesc(application.getId())).thenReturn(List.of(note));
        when(interviews.findByApplication_IdOrderByScheduledAtAsc(application.getId())).thenReturn(List.of());
        when(applicationEventRepository.findByApplication_IdOrderByCreatedAtDesc(application.getId())).thenReturn(List.of());
        when(recruiters.findByOrganisation_IdOrderByFullNameAsc(organisation.getId())).thenReturn(List.of(recruiter));
        when(parses.existsByCandidate_Id(candidate.getId())).thenReturn(true);

        RecruiterJobApplicantDetailResponse response = service.jobApplicant(recruiter.getId(), job.getPublicJobId(), application.getId());

        assertThat(response.fullName()).isEqualTo("Mira Rao");
        assertThat(response.highestEducation()).isEqualTo("M.Des · NID 2021");
        assertThat(response.maskedEmail()).doesNotContain("mira@example.test");
        assertThat(response.cvAvailable()).isTrue();
        assertThat(response.recentNotes()).extracting(RecruiterJobApplicantDetailResponse.Note::text)
                .containsExactly("Strong portfolio evidence.");
        assertThatThrownBy(() -> service.jobApplicant(recruiter.getId(), "SWX_NX_OTHER", application.getId()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("not found for this job");
    }

    @Test
    void postingRecruiterCanAssignAnOrganisationMemberAndRecordsTheDecision() {
        Recruiter assignee = Recruiter.builder().id(UUID.randomUUID()).fullName("Priya Interviewer")
                .officialEmail("priya@nexora.test").organisation(organisation).build();
        Job job = Job.builder().internalId(UUID.randomUUID()).publicJobId("SWX_NX_202").title("Design Lead")
                .department("Design").employmentType(EmploymentType.FULL_TIME).workplaceModel(WorkplaceModel.HYBRID)
                .location("Bengaluru").minimumExperienceYears(5).maximumExperienceYears(8).skills(new LinkedHashSet<>())
                .status(JobStatus.ACTIVE).organisation(organisation).createdByRecruiter(recruiter).build();
        Candidate candidate = Candidate.builder().id(UUID.randomUUID()).fullName("Mira Rao").email("mira@example.test")
                .mobile("+919800000001").preferredLocations(List.of()).workLinks(List.of())
                .education(new LinkedHashSet<>()).skills(new LinkedHashSet<>()).build();
        JobApplication application = JobApplication.builder().id(UUID.randomUUID()).job(job).candidate(candidate)
                .recipientRecruiter(recruiter).pipelineStage(PipelineStage.APPLIED).applicationSource(ApplicationSource.DIRECT).build();
        when(applications.findById(application.getId())).thenReturn(Optional.of(application));
        when(recruiters.findById(assignee.getId())).thenReturn(Optional.of(assignee));
        when(recruiters.findByOrganisation_IdOrderByFullNameAsc(organisation.getId())).thenReturn(List.of(recruiter, assignee));
        when(notes.findTop10ByApplication_IdOrderByUpdatedAtDesc(application.getId())).thenReturn(List.of());
        when(interviews.findByApplication_IdOrderByScheduledAtAsc(application.getId())).thenReturn(List.of());
        when(applicationEventRepository.findByApplication_IdOrderByCreatedAtDesc(application.getId())).thenReturn(List.of());

        RecruiterJobApplicantDetailResponse response = service.assignApplicant(recruiter.getId(), job.getPublicJobId(), application.getId(), assignee.getId());

        assertThat(response.assignedRecruiterId()).isEqualTo(assignee.getId());
        assertThat(response.assignedRecruiterName()).isEqualTo("Priya Interviewer");
        verify(applicationEvents).record(eq(application), eq("RECRUITER"), eq("APPLICATION_OWNER_CHANGED"), contains("Priya Interviewer"));
    }

    @Test
    void panelReviewerCanInspectAndScoreButCannotManageTheApplication() {
        Recruiter reviewer = Recruiter.builder().id(UUID.randomUUID()).fullName("Priya Interviewer")
                .officialEmail("priya@nexora.test").organisation(organisation).build();
        Job job = Job.builder().internalId(UUID.randomUUID()).publicJobId("SWX_NX_203").title("Platform Lead")
                .department("Engineering").employmentType(EmploymentType.FULL_TIME).workplaceModel(WorkplaceModel.HYBRID)
                .location("Bengaluru").minimumExperienceYears(5).maximumExperienceYears(8).skills(new LinkedHashSet<>())
                .status(JobStatus.ACTIVE).organisation(organisation).createdByRecruiter(recruiter).build();
        Candidate candidate = Candidate.builder().id(UUID.randomUUID()).fullName("Taylor Tech").email("taylor@example.test")
                .mobile("+919800000002").preferredLocations(List.of()).workLinks(List.of())
                .education(new LinkedHashSet<>()).skills(new LinkedHashSet<>()).build();
        JobApplication application = JobApplication.builder().id(UUID.randomUUID()).job(job).candidate(candidate)
                .recipientRecruiter(recruiter).pipelineStage(PipelineStage.SCREENING).applicationSource(ApplicationSource.DIRECT).build();
        Interview interview = Interview.builder().id(UUID.randomUUID()).application(application).recruiter(recruiter)
                .platformName("Google Meet").meetingLink("https://meet.google.com/test").scheduledAt(Instant.now().plusSeconds(3600))
                .durationMinutes(45).panelRecruiterIds(List.of(reviewer.getId())).status(InterviewStatus.SCHEDULED).build();
        InterviewScorecard positive = InterviewScorecard.builder().id(UUID.randomUUID()).interview(interview).recruiter(recruiter)
                .recommendation("YES").score(4).feedback("Proceed.").build();
        InterviewScorecard negative = InterviewScorecard.builder().id(UUID.randomUUID()).interview(interview).recruiter(reviewer)
                .recommendation("NO").score(2).feedback("Evidence gap.").build();
        when(recruiters.findById(reviewer.getId())).thenReturn(Optional.of(reviewer));
        when(applications.findById(application.getId())).thenReturn(Optional.of(application));
        when(interviews.findByApplication_IdOrderByScheduledAtAsc(application.getId())).thenReturn(List.of(interview));
        when(recruiters.findByOrganisation_IdOrderByFullNameAsc(organisation.getId())).thenReturn(List.of(recruiter, reviewer));
        when(notes.findTop10ByApplication_IdOrderByUpdatedAtDesc(application.getId())).thenReturn(List.of());
        when(applicationEventRepository.findByApplication_IdOrderByCreatedAtDesc(application.getId())).thenReturn(List.of());
        when(scorecards.findByInterview_IdOrderBySubmittedAtDesc(interview.getId())).thenReturn(List.of(negative, positive));

        RecruiterJobApplicantDetailResponse response = service.jobApplicant(reviewer.getId(), job.getPublicJobId(), application.getId());

        assertThat(response.currentUserCanManage()).isFalse();
        assertThat(response.interviews()).singleElement().satisfies(value -> assertThat(value.currentUserCanScore()).isTrue());
        assertThat(response.decisionReadiness().conflictingRecommendations()).isTrue();
        assertThatThrownBy(() -> service.moveStage(reviewer.getId(), application.getId(), PipelineStage.INTERVIEWING))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("assigned owner");
        assertThatThrownBy(() -> service.moveStage(recruiter.getId(), application.getId(), PipelineStage.OFFER))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Offer readiness is incomplete");
    }

    @Test
    void offerStageRequiresAndAcceptsCompletePositiveInterviewEvidence() {
        Job job = Job.builder().internalId(UUID.randomUUID()).publicJobId("SWX_NX_204").title("Backend Lead")
                .department("Engineering").employmentType(EmploymentType.FULL_TIME).workplaceModel(WorkplaceModel.HYBRID)
                .location("Bengaluru").minimumExperienceYears(5).maximumExperienceYears(8).skills(new LinkedHashSet<>())
                .status(JobStatus.ACTIVE).organisation(organisation).createdByRecruiter(recruiter).build();
        Candidate candidate = Candidate.builder().id(UUID.randomUUID()).fullName("Taylor Tech").email("taylor@example.test")
                .mobile("+919800000002").preferredLocations(List.of()).workLinks(List.of())
                .education(new LinkedHashSet<>()).skills(new LinkedHashSet<>()).build();
        JobApplication application = JobApplication.builder().id(UUID.randomUUID()).job(job).candidate(candidate)
                .recipientRecruiter(recruiter).requiredOfferApprovals(1).pipelineStage(PipelineStage.FINAL_STAGE).applicationSource(ApplicationSource.DIRECT).build();
        Interview interview = Interview.builder().id(UUID.randomUUID()).application(application).recruiter(recruiter)
                .platformName("Google Meet").meetingLink("https://meet.google.com/test").scheduledAt(Instant.now().minusSeconds(3600))
                .durationMinutes(45).panelRecruiterIds(List.of()).status(InterviewStatus.COMPLETED).build();
        InterviewScorecard scorecard = InterviewScorecard.builder().id(UUID.randomUUID()).interview(interview).recruiter(recruiter)
                .recommendation("YES").score(4).criteriaScores(java.util.Map.of("technical", 4)).feedback("Strong evidence.").build();
        when(applications.findById(application.getId())).thenReturn(Optional.of(application));
        when(interviews.findByApplication_IdOrderByScheduledAtAsc(application.getId())).thenReturn(List.of(interview));
        when(scorecards.findByInterview_IdOrderBySubmittedAtDesc(interview.getId())).thenReturn(List.of(scorecard));
        when(notes.findTop10ByApplication_IdOrderByUpdatedAtDesc(application.getId())).thenReturn(List.of());

        service.moveStage(recruiter.getId(), application.getId(), PipelineStage.OFFER);

        assertThat(application.getPipelineStage()).isEqualTo(PipelineStage.OFFER);
    }
}

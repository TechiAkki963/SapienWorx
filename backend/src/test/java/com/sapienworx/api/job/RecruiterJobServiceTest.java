package com.sapienworx.api.job;

import com.sapienworx.api.admin.OrganisationBillingPolicy;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import com.sapienworx.api.application.ApplicationSource;
import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.application.JobApplicationMetricsProjection;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateSkill;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.taxonomy.DomainCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RecruiterJobServiceTest {
    private final JobService jobService = mock(JobService.class);
    private final JobRepository jobs = mock(JobRepository.class);
    private final RecruiterRepository recruiters = mock(RecruiterRepository.class);
    private final JobApplicationRepository applications = mock(JobApplicationRepository.class);
    private final JobDescriptionSanitizer sanitizer = mock(JobDescriptionSanitizer.class);
    private final PlatformAccessPolicy accessPolicy = mock(PlatformAccessPolicy.class);
    private final OrganisationBillingPolicy billingPolicy = mock(OrganisationBillingPolicy.class);
    private final Organisation organisation = Organisation.builder().id(UUID.randomUUID()).name("Nexora Technologies")
            .initials("NT").workEmailDomain("nexora.test").build();
    private final Recruiter recruiter = Recruiter.builder().id(UUID.randomUUID()).fullName("Alex Recruiter")
            .officialEmail("alex@nexora.test").organisation(organisation).build();
    private RecruiterJobService service;

    @BeforeEach
    void setUp() {
        service = new RecruiterJobService(jobService, jobs, recruiters, applications, sanitizer, accessPolicy, billingPolicy);
        when(recruiters.findById(recruiter.getId())).thenReturn(Optional.of(recruiter));
        when(sanitizer.sanitize(any(String.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void incompleteWorkCanBeSavedAsADraft() {
        when(jobService.create(any(Job.class), any(Recruiter.class))).thenAnswer(invocation -> {
            Job job = invocation.getArgument(0);
            job.setPublicJobId("SWX_NT_101");
            job.setOrganisation(organisation);
            job.setCreatedByRecruiter(recruiter);
            return job;
        });

        JobUpsertRequest partial = new JobUpsertRequest(null, null, null, null, null, null, null,
                null, null, false, null, null, null, null, null, null, null);

        JobResponse saved = service.createDraft(recruiter.getId(), partial);

        assertThat(saved.status()).isEqualTo(JobStatus.DRAFT);
        assertThat(saved.title()).isEqualTo("Untitled role");
        assertThat(saved.minimumExperienceYears()).isZero();
        assertThat(saved.skills()).isEmpty();
    }

    @Test
    void publishingRejectsAnIncompleteCandidateStory() {
        Job job = completeJob();
        job.setResponsibilitiesHtml("");
        when(jobs.findByPublicJobId(job.getPublicJobId())).thenReturn(Optional.of(job));

        assertThatThrownBy(() -> service.publish(recruiter.getId(), job.getPublicJobId()))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                    assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getReason()).contains("responsibilities");
                });
        assertThat(job.getStatus()).isEqualTo(JobStatus.DRAFT);
    }

    @Test
    void publishingKeepsInternalCompensationAvailableToTheRecruiter() {
        Job job = completeJob();
        when(jobs.findByPublicJobId(job.getPublicJobId())).thenReturn(Optional.of(job));

        JobResponse published = service.publish(recruiter.getId(), job.getPublicJobId());

        assertThat(published.status()).isEqualTo(JobStatus.ACTIVE);
        assertThat(published.publishedAt()).isNotNull();
        assertThat(published.salaryVisible()).isFalse();
        assertThat(published.minimumSalaryLakhs()).isEqualTo(20);
        assertThat(JobResponse.from(job).minimumSalaryLakhs()).isNull();
    }

    @Test
    void listReturnsRealPipelineMetricsForEachJob() {
        Job job = completeJob();
        JobApplicationMetricsProjection metrics = mock(JobApplicationMetricsProjection.class);
        when(jobs.findByOrganisation_IdOrderByUpdatedAtDesc(organisation.getId(), PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(job)));
        when(metrics.getJobInternalId()).thenReturn(job.getInternalId());
        when(metrics.getApplicants()).thenReturn(18L);
        when(metrics.getNewApplicants()).thenReturn(5L);
        when(metrics.getInterviewing()).thenReturn(3L);
        when(metrics.getFinalStage()).thenReturn(1L);
        when(metrics.getOffers()).thenReturn(2L);
        when(metrics.getLatestApplicationAt()).thenReturn(Instant.parse("2026-08-30T04:30:00Z"));
        when(applications.summarizeByJobIds(List.of(job.getInternalId()))).thenReturn(List.of(metrics));

        RecruiterManagedJobResponse result = service.list(recruiter.getId(), null, PageRequest.of(0, 20)).getContent().get(0);

        assertThat(result.applicants()).isEqualTo(18);
        assertThat(result.newApplicants()).isEqualTo(5);
        assertThat(result.interviewing()).isEqualTo(3);
        assertThat(result.finalStage()).isEqualTo(1);
        assertThat(result.offers()).isEqualTo(2);
    }

    @Test
    void workspaceReturnsOnlyTheSelectedJobsLiveApplicantsAndStory() {
        Job job = completeJob();
        Candidate candidate = Candidate.builder().id(UUID.randomUUID()).fullName("Mira Rao")
                .email("mira@example.test").mobile("+919800000001").headline("Staff Product Designer")
                .lastActiveAt(Instant.parse("2026-08-29T09:00:00Z")).build();
        CandidateSkill skill = CandidateSkill.builder().candidate(candidate).skill("Design systems").rating(5).build();
        candidate.setSkills(new LinkedHashSet<>(Set.of(skill)));
        JobApplication application = JobApplication.builder().id(UUID.randomUUID()).job(job).candidate(candidate)
                .applicationSource(ApplicationSource.DIRECT).pipelineStage(PipelineStage.INTERVIEWING).build();
        when(jobs.findByPublicJobId(job.getPublicJobId())).thenReturn(Optional.of(job));
        when(applications.summarizeByJobIds(List.of(job.getInternalId()))).thenReturn(List.of());
        when(applications.findByJob_InternalIdAndRecipientRecruiter_IdOrderByUpdatedAtDesc(job.getInternalId(), recruiter.getId(), PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(application)));

        RecruiterJobWorkspaceResponse result = service.workspace(recruiter.getId(), job.getPublicJobId(), PageRequest.of(0, 20));

        assertThat(result.summary().job().jobId()).isEqualTo(job.getPublicJobId());
        assertThat(result.summary().job().companyOverview()).isEqualTo(job.getCompanyOverview());
        assertThat(result.applications().totalElements()).isEqualTo(1);
        assertThat(result.applications().content().get(0).fullName()).isEqualTo("Mira Rao");
        assertThat(result.applications().content().get(0).pipelineStage()).isEqualTo(PipelineStage.INTERVIEWING);
        assertThat(result.applications().content().get(0).skills()).containsExactly("Design systems");
    }

    @Test
    void lifecycleAllowsReopeningButRejectsClosingAnUnpublishedDraft() {
        Job job = completeJob();
        job.setStatus(JobStatus.CLOSED);
        job.setClosedAt(Instant.now());
        when(jobs.findByPublicJobId(job.getPublicJobId())).thenReturn(Optional.of(job));

        JobResponse reopened = service.changeStatus(recruiter.getId(), job.getPublicJobId(), JobStatus.ACTIVE);

        assertThat(reopened.status()).isEqualTo(JobStatus.ACTIVE);
        assertThat(job.getClosedAt()).isNull();

        job.setStatus(JobStatus.DRAFT);
        assertThatThrownBy(() -> service.changeStatus(recruiter.getId(), job.getPublicJobId(), JobStatus.CLOSED))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    private Job completeJob() {
        return Job.builder().internalId(UUID.randomUUID()).publicJobId("SWX_NT_102")
                .title("Principal Product Designer").department("Product").employmentType(EmploymentType.FULL_TIME)
                .workplaceModel(WorkplaceModel.HYBRID).location("Bengaluru, India")
                .minimumExperienceYears(6).maximumExperienceYears(9).minimumSalaryLakhs(20).maximumSalaryLakhs(30)
                .salaryVisible(false).descriptionHtml("<p>Lead the product design practice.</p>")
                .companyOverview("Nexora builds trusted recruitment infrastructure.")
                .whyJoin("Shape a product used by ambitious hiring teams.")
                .responsibilitiesHtml("<ul><li>Lead product discovery</li></ul>")
                .hiringProcess("Application review\nRecruiter conversation\nPortfolio conversation\nFinal decision")
                .skills(new LinkedHashSet<>(Set.of("Figma", "Design systems"))).domainCategory(DomainCategory.TECH)
                .status(JobStatus.DRAFT).organisation(organisation).createdByRecruiter(recruiter).build();
    }
}

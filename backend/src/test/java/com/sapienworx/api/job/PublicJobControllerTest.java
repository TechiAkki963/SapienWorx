package com.sapienworx.api.job;

import com.sapienworx.api.admin.PlatformAccessPolicy;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.taxonomy.DomainCategory;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PublicJobControllerTest {

    @Test
    void similarJobsPreferSharedDepartmentDomainAndSkills() {
        JobRepository jobs = mock(JobRepository.class);
        PlatformAccessPolicy accessPolicy = mock(PlatformAccessPolicy.class);
        PublicJobController controller = new PublicJobController(jobs, accessPolicy);
        Organisation organisation = Organisation.builder().id(UUID.randomUUID()).name("Verified Co")
                .initials("VC").workEmailDomain("verified.test").build();

        Job source = job("SWX_001", "Platform Engineer", "Engineering", DomainCategory.TECH,
                WorkplaceModel.HYBRID, List.of("Java", "Kubernetes"), organisation, 4);
        Job closeMatch = job("SWX_002", "Cloud Engineer", "Engineering", DomainCategory.TECH,
                WorkplaceModel.REMOTE, List.of("Kubernetes", "AWS"), organisation, 3);
        Job distantMatch = job("SWX_003", "Growth Manager", "Marketing", DomainCategory.NON_TECH,
                WorkplaceModel.HYBRID, List.of("Analytics"), organisation, 2);

        when(jobs.findByPublicJobId("SWX_001")).thenReturn(Optional.of(source));
        when(jobs.findByStatusOrderByPublishedAtDesc(eq(JobStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(distantMatch, source, closeMatch)));

        List<JobResponse> result = controller.similar("SWX_001", 2);

        assertThat(result).extracting(JobResponse::jobId).containsExactly("SWX_002", "SWX_003");
        assertThat(result.get(0).verifiedEmployer()).isTrue();
    }

    private Job job(String id, String title, String department, DomainCategory domain, WorkplaceModel workplace,
                    List<String> skills, Organisation organisation, int daysOld) {
        return Job.builder().internalId(UUID.randomUUID()).publicJobId(id).title(title).department(department)
                .employmentType(EmploymentType.FULL_TIME).workplaceModel(workplace).location("Bengaluru")
                .minimumExperienceYears(2).maximumExperienceYears(6).salaryVisible(false)
                .descriptionHtml("<p>Role summary</p>").skills(new LinkedHashSet<>(skills)).status(JobStatus.ACTIVE)
                .domainCategory(domain).publishedAt(Instant.now().minusSeconds(daysOld * 86_400L))
                .organisation(organisation).build();
    }
}

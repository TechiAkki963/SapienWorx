package com.sapienworx.api.config;

import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateEducation;
import com.sapienworx.api.candidate.CandidateRegistrationStatus;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.candidate.CandidateSkill;
import com.sapienworx.api.candidate.EducationLevel;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.organisation.OrganisationRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.recruiter.RecruiterType;
import com.sapienworx.api.taxonomy.DomainCategory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Deterministic accounts for a disposable QA database. This configuration is
 * deliberately isolated to the explicit {@code qa} Spring profile.
 */
@Configuration
@Profile("qa")
@ConditionalOnProperty(prefix = "app.qa", name = "enabled", havingValue = "true")
public class QaAccessConfiguration {

    private static final String ORGANISATION_NAME = "Sapienworx QA Organisation";

    @Bean
    ApplicationRunner qaAccountSeeder(
            OrganisationRepository organisationRepository,
            RecruiterRepository recruiterRepository,
            CandidateRepository candidateRepository,
            JobRepository jobRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.qa.test-account-password}") String password
    ) {
        return ignored -> {
            Organisation organisation = organisationRepository.findByNameIgnoreCase(ORGANISATION_NAME)
                    .orElseGet(() -> organisationRepository.save(Organisation.builder()
                            .name(ORGANISATION_NAME)
                            .initials("SWXQA")
                            .build()));

            seedRecruiter(recruiterRepository, passwordEncoder, organisation,
                    "Alex Recruiter", "recruiter.alex@sapienworx.qa", "+919000000011", "Senior Recruiter", "Bengaluru", password);
            seedRecruiter(recruiterRepository, passwordEncoder, organisation,
                    "Sam Recruiter", "recruiter.sam@sapienworx.qa", "+919000000012", "Talent Partner", "Pune", password);

            seedCandidate(candidateRepository, passwordEncoder,
                    "Taylor Tech", "candidate.tech@sapienworx.qa", "+919000000021", DomainCategory.TECH,
                    "Backend Engineer", "Sapienworx Labs", "Bengaluru", List.of("Java", "Spring Boot", "RabbitMQ"), password);
            seedCandidate(candidateRepository, passwordEncoder,
                    "Uma Unassigned", "candidate.unassigned@sapienworx.qa", "+919000000022", DomainCategory.UNASSIGNED,
                    "Graduate candidate", null, "Pune", List.of("Communication", "Research"), password);

            seedPublishedJobs(jobRepository, organisationRepository, recruiterRepository, passwordEncoder, password);
        };
    }

    private void seedRecruiter(
            RecruiterRepository repository,
            PasswordEncoder passwordEncoder,
            Organisation organisation,
            String fullName,
            String email,
            String mobile,
            String designation,
            String location,
            String password
    ) {
        if (repository.findByOfficialEmail(email).isPresent()) return;
        repository.save(Recruiter.builder()
                .fullName(fullName)
                .officialEmail(email)
                .mobile(mobile)
                .passwordHash(passwordEncoder.encode(password))
                .organisation(organisation)
                .designation(designation)
                .location(location)
                .recruiterType(RecruiterType.EMPLOYER)
                .emailVerified(true)
                .mobileVerified(true)
                .build());
    }

    private void seedCandidate(
            CandidateRepository repository,
            PasswordEncoder passwordEncoder,
            String fullName,
            String email,
            String mobile,
            DomainCategory domain,
            String headline,
            String company,
            String location,
            List<String> skills,
            String password
    ) {
        Candidate existing = repository.findByEmail(email).orElse(null);
        if (existing != null) {
            boolean changed = false;
            if (existing.getPreviousRole() == null) { existing.setPreviousRole(domain == DomainCategory.TECH ? "Software Engineer" : "Research Associate"); changed = true; }
            if (existing.getPreviousCompany() == null) { existing.setPreviousCompany(domain == DomainCategory.TECH ? "QA Platform Services" : "QA Research Collective"); changed = true; }
            if (existing.getDepartmentRole() == null) { existing.setDepartmentRole(domain == DomainCategory.TECH ? "Engineering / Platform" : "Research / Operations"); changed = true; }
            if (existing.getIndustry() == null) { existing.setIndustry(domain == DomainCategory.TECH ? "Software product" : "Research services"); changed = true; }
            if (existing.getGender() == null) { existing.setGender(domain == DomainCategory.TECH ? "female" : "male"); changed = true; }
            if (existing.getPreferredLocations() == null || existing.getPreferredLocations().isEmpty()) { existing.setPreferredLocations(domain == DomainCategory.TECH ? List.of("Bengaluru", "Pune", "Remote") : List.of("Pune", "Remote")); changed = true; }
            if (existing.getProfileSummary() == null) { existing.setProfileSummary(domain == DomainCategory.TECH ? "Backend engineer experienced in reliable, event-driven recruitment workflows." : "Early-career professional with research and communication strengths."); changed = true; }
            if (changed) repository.save(existing);
            return;
        }
        Candidate candidate = Candidate.builder()
                .fullName(fullName)
                .email(email)
                .mobile(mobile)
                .passwordHash(passwordEncoder.encode(password))
                .headline(headline)
                .currentCompany(company)
                .departmentRole(domain == DomainCategory.TECH ? "Engineering / Platform" : "Research / Operations")
                .industry(domain == DomainCategory.TECH ? "Software product" : "Research services")
                .previousRole(domain == DomainCategory.TECH ? "Software Engineer" : "Research Associate")
                .previousCompany(domain == DomainCategory.TECH ? "QA Platform Services" : "QA Research Collective")
                .location(location)
                .preferredLocations(domain == DomainCategory.TECH ? List.of("Bengaluru", "Pune", "Remote") : List.of("Pune", "Remote"))
                .overallExperienceYears(domain == DomainCategory.TECH ? 4 : 0)
                .expectedSalaryLakhs(domain == DomainCategory.TECH ? 18 : 6)
                .noticePeriodDays(30)
                .profileSummary(domain == DomainCategory.TECH
                        ? "Backend engineer experienced in reliable, event-driven recruitment workflows."
                        : "Early-career professional with research and communication strengths.")
                .profileSearchable(true)
                .lastActiveAt(Instant.now())
                .domainCategory(domain)
                .gender(domain == DomainCategory.TECH ? "female" : "male")
                .emailVerified(true)
                .mobileVerified(true)
                .termsAccepted(true)
                .automationConsent(false)
                .registrationStatus(CandidateRegistrationStatus.ACTIVE)
                .workLinks(domain == DomainCategory.TECH ? List.of("https://github.com/sapienworx-qa") : List.of())
                .build();
        candidate.setSkills(Set.copyOf(skills.stream()
                .map(skill -> CandidateSkill.builder().candidate(candidate).skill(skill).rating(4)
                        .yearsOfExperience(domain == DomainCategory.TECH ? 3 : null).build())
                .toList()));
        candidate.setEducation(Set.of(CandidateEducation.builder()
                .candidate(candidate)
                .level(EducationLevel.BACHELORS)
                .degreeName(domain == DomainCategory.TECH ? "B.Tech" : "B.A.")
                .institutionName("Sapienworx QA Institute")
                .graduationYear(2024)
                .build()));
        repository.save(candidate);
    }

    /**
     * A useful local job board needs real, application-ready jobs. These stay
     * in the isolated QA profile and intentionally mirror the candidate jobs
     * page's fallback set, so the page remains usable before a recruiter adds
     * their own vacancies.
     */
    private void seedPublishedJobs(
            JobRepository jobRepository,
            OrganisationRepository organisationRepository,
            RecruiterRepository recruiterRepository,
            PasswordEncoder passwordEncoder,
            String password
    ) {
        List<JobSeed> jobs = List.of(
                new JobSeed("SWX_NX_001", "Nexora Cloud", "NX", "Senior Backend Engineer", "Engineering", "Bengaluru · Hybrid", 4, 7, 18, 28, DomainCategory.TECH, List.of("TypeScript", "Node.js", "PostgreSQL"), "Build reliable data and workflow services for a fast-growing hiring platform."),
                new JobSeed("SWX_AT_001", "Atlas Labs", "AT", "Product Manager", "Product", "Remote", 4, 8, 20, 32, DomainCategory.NON_TECH, List.of("Product strategy", "SQL", "Discovery"), "Own a product area from discovery to measurable customer outcomes."),
                new JobSeed("SWX_PH_001", "Pulse Health", "PH", "Data Analyst", "Analytics", "Pune · Hybrid", 2, 5, 10, 16, DomainCategory.TECH, List.of("SQL", "Python", "Tableau"), "Turn operational data into decisions that improve patient services."),
                new JobSeed("SWX_MR_001", "Morrow", "MR", "Product Designer", "Design", "Mumbai", 3, 6, 14, 22, DomainCategory.NON_TECH, List.of("Figma", "Research", "Design systems"), "Design intuitive digital journeys for a consumer-first financial product."),
                new JobSeed("SWX_KS_001", "Keystone", "KS", "Cloud Engineer", "Engineering", "Remote", 3, 6, 16, 25, DomainCategory.TECH, List.of("AWS", "Docker", "Kubernetes"), "Help build resilient infrastructure and modern delivery platforms."),
                new JobSeed("SWX_NV_001", "Northstar Ventures", "NV", "Growth Marketing Manager", "Marketing", "Gurugram", 4, 7, 18, 27, DomainCategory.NON_TECH, List.of("GTM", "Analytics", "B2B SaaS"), "Shape the acquisition and lifecycle strategy for a growing B2B platform.")
        );
        for (int index = 0; index < jobs.size(); index++) {
            JobSeed seed = jobs.get(index);
            Organisation organisation = organisationRepository.findByNameIgnoreCase(seed.organisationName())
                    .orElseGet(() -> organisationRepository.save(Organisation.builder()
                            .name(seed.organisationName()).initials(seed.organisationInitials()).jobSequence(1).build()));
            if (organisation.getJobSequence() < 1) {
                organisation.setJobSequence(1);
                organisationRepository.save(organisation);
            }
            String ownerEmail = "hiring." + seed.organisationInitials().toLowerCase(java.util.Locale.ROOT) + "@sapienworx.qa";
            seedRecruiter(recruiterRepository, passwordEncoder, organisation,
                    seed.organisationName() + " Hiring", ownerEmail, String.format("+9190000001%02d", index + 1),
                    "Hiring Manager", seed.location(), password);
            Recruiter owner = recruiterRepository.findByOfficialEmail(ownerEmail).orElseThrow();
            Job existing = jobRepository.findByPublicJobId(seed.publicJobId()).orElse(null);
            if (existing != null) {
                if (existing.getCreatedByRecruiter() == null) {
                    existing.setCreatedByRecruiter(owner);
                    jobRepository.save(existing);
                }
                continue;
            }
            jobRepository.save(Job.builder()
                    .publicJobId(seed.publicJobId())
                    .title(seed.title())
                    .department(seed.department())
                    .location(seed.location())
                    .minimumExperienceYears(seed.minimumExperienceYears())
                    .maximumExperienceYears(seed.maximumExperienceYears())
                    .minimumSalaryLakhs(seed.minimumSalaryLakhs())
                    .maximumSalaryLakhs(seed.maximumSalaryLakhs())
                    .domainCategory(seed.domainCategory())
                    .salaryVisible(true)
                    .descriptionHtml("<p>" + seed.description() + "</p>")
                    .skills(new LinkedHashSet<>(seed.skills()))
                    .status(JobStatus.ACTIVE)
                    .publishedAt(Instant.now())
                    .organisation(organisation)
                    .createdByRecruiter(owner)
                    .build());
        }
    }

    private record JobSeed(
            String publicJobId,
            String organisationName,
            String organisationInitials,
            String title,
            String department,
            String location,
            int minimumExperienceYears,
            int maximumExperienceYears,
            int minimumSalaryLakhs,
            int maximumSalaryLakhs,
            DomainCategory domainCategory,
            List<String> skills,
            String description
    ) { }
}

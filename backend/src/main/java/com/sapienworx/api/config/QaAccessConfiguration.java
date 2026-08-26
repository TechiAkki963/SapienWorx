package com.sapienworx.api.config;

import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateEducation;
import com.sapienworx.api.candidate.CandidateRegistrationStatus;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.candidate.CandidateSkill;
import com.sapienworx.api.candidate.EducationLevel;
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
        if (repository.findByEmail(email).isPresent()) return;
        Candidate candidate = Candidate.builder()
                .fullName(fullName)
                .email(email)
                .mobile(mobile)
                .passwordHash(passwordEncoder.encode(password))
                .headline(headline)
                .currentCompany(company)
                .location(location)
                .overallExperienceYears(domain == DomainCategory.TECH ? 4 : 0)
                .expectedSalaryLakhs(domain == DomainCategory.TECH ? 18 : 6)
                .noticePeriodDays(30)
                .profileSearchable(true)
                .lastActiveAt(Instant.now())
                .domainCategory(domain)
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
}

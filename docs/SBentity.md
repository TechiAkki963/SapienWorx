# Master Architecture Prompt: Spring Boot Data Models & Security

**Objective:** Implement the core JPA entity relationships for Candidates and Jobs (including the bespoke auto-incrementing Job ID generator), and establish a stateless Spring Security configuration to handle the dual-factor OTP authentication via HTTP-only cookies.

---

## 1. Spring Boot Core Entities (JPA / Hibernate)

The backend must utilise Lombok for boilerplate reduction and strict JPA annotations to guarantee database integrity across PostgreSQL.

### The Candidate Entity

This entity isolates the core applicant data and enforces strict Digital Personal Data Protection (DPDP) compliance tracking.

\`\`\`java
import jakarta.persistence._;
import lombok._;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "candidates")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false, unique = true)
    private String mobile;

    // DPDP & GDPR Compliance Flags
    @Column(nullable = false)
    private boolean termsAccepted;

    @Column(nullable = false)
    private boolean automationConsent;

    @Column(nullable = false)
    private boolean deletionRequested;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // TODO: Implement One-to-Many relationships to Experience, Education, and Skills.

}
\`\`\`

### The Job Entity (With Custom ID Generation)

This entity handles the platform's vacancies. It mandates a `@PrePersist` lifecycle hook to generate the `SWX_{Initials}_{Sequence}` identifier upon initial save.

\`\`\`java
import jakarta.persistence._;
import lombok._;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "jobs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID internalId; // Primary key for foreign key relations

    @Column(unique = true, updatable = false)
    private String publicJobId; // e.g., SWX_NT_001

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String department;

    @Column(nullable = false)
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private JobStatus status; // DRAFT, ACTIVE, CLOSED, ARCHIVED

    @Column(name = "min_salary")
    private Integer minimumSalary;

    @Column(name = "max_salary")
    private Integer maximumSalary;

    // The owning organisation (Tenant)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organisation_id", nullable = false)
    private Organisation organisation;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Lifecycle hook for bespoke Job ID generation
    @PrePersist
    public void generatePublicJobId() {
        if (this.publicJobId == null && this.organisation != null) {
            // ENGINEERING DIRECTIVE: The sequence counter must be fetched atomically
            // from the database to prevent race conditions during concurrent job creation.
            String initials = this.organisation.getInitials();
            Long nextSequence = this.organisation.getNextJobSequence();
            this.publicJobId = String.format("SWX_%s_%03d", initials, nextSequence);
        }
    }

}

enum JobStatus { DRAFT, ACTIVE, CLOSED, ARCHIVED }
\`\`\`

---

## 2. Spring Security & OTP Authentication

To seamlessly support the Next.js SSR frontend, the Spring Security layer must forgo traditional basic authentication. It must rely strictly on a stateless token exchange secured via HTTP-only cookies.

### The Security Filter Chain

The configuration class must strictly isolate public routes from protected API boundaries using role-based access control (RBAC).

\`\`\`java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // Ensure proper CSRF management if strictly using cookies
            .cors(cors -> cors.configure(http))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/public/jobs/**").permitAll()

                // Protected Recruiter endpoints
                .requestMatchers("/api/recruiter/**").hasAnyRole("RECRUITER", "ADMIN")

                // Protected Candidate endpoints
                .requestMatchers("/api/candidate/**").hasRole("CANDIDATE")

                // Master Admin endpoints
                .requestMatchers("/api/admin/**").hasRole("SUPER_ADMIN")

                .anyRequest().authenticated()
            )
            // Inject custom filter before standard auth filter
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

}
\`\`\`

### Authentication Flow Directives

1.  **OTP Generation:** When `/api/auth/request-otp` is hit, generate a secure 6-digit hash, store it in Redis with a 10-minute TTL, and dispatch to the messaging queue.
2.  **Verification:** Validate submissions at `/api/auth/verify-otp` against Redis.
3.  **Authorisation Context:** Upon success, issue a JWT and write it directly to the response as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. The `JwtAuthenticationFilter` must intercept this cookie on subsequent requests to populate the `SecurityContextHolder`.

# Master Architecture Prompt: Database Layer & Advanced Sourcing Engine

**Objective:** Finalise the core JPA entity mappings (Organisation, Recruiter, AuditLog, and Candidate relationships) and implement the Advanced Sourcing Engine using native PostgreSQL full-text search (`tsvector` and `tsquery`) within Spring Data JPA.

---

## 1. Missing Entities & Strict Relational Mapping

The backend team must map these foundational entities, ensuring strict relational integrity. The `AuditLog` entity must be entirely immutable to satisfy DPDP compliance.

### Organisation & Recruiter Entities

These entities manage multi-tenancy and role-based access control.

```java
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "organisations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Organisation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false, length = 5)
    private String initials; // Used for SWX_INT_001 Job ID generation

    @Column(nullable = false)
    private Long nextJobSequence = 1L; // Must be handled atomically

    @OneToMany(mappedBy = "organisation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Job> jobs;

    @OneToMany(mappedBy = "organisation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Recruiter> recruiters;
}

@Entity
@Table(name = "recruiters")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Recruiter {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String officialEmail;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organisation_id", nullable = false)
    private Organisation organisation;
}
```

package com.sapienworx.api.candidate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(
        name = "candidate_skills",
        uniqueConstraints = @UniqueConstraint(name = "uk_candidate_skills_candidate_skill", columnNames = {"candidate_id", "skill"})
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandidateSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @Column(nullable = false, length = 100)
    private String skill;

    @Column(name = "rating", nullable = false)
    private Integer rating;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    @Column(name = "experience_months")
    private Integer experienceMonths;

    @Column(name = "software_version", length = 80)
    private String softwareVersion;

    @Column(name = "last_used_year")
    private Integer lastUsedYear;
}

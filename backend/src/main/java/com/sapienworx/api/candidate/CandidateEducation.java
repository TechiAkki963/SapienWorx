package com.sapienworx.api.candidate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "candidate_educations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandidateEducation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @Enumerated(EnumType.STRING)
    @Column(name = "level", nullable = false, length = 16)
    private EducationLevel level;

    @Column(name = "degree_name", nullable = false, length = 180)
    private String degreeName;

    @Column(name = "institution_name", nullable = false, length = 200)
    private String institutionName;

    @Column(name = "graduation_year")
    private Integer graduationYear;

    @Column(name = "course_start_year")
    private Integer courseStartYear;

    @Column(length = 180)
    private String specialization;

    @Column(name = "study_type", nullable = false, length = 32)
    @Builder.Default
    private String studyType = "FULL_TIME";

    @Column(length = 40)
    private String grade;
}

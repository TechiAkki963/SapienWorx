package com.sapienworx.api.recruiter;

import com.sapienworx.api.organisation.Organisation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

import com.sapienworx.api.recruiter.RecruiterType;

/** A recruiter belongs to exactly one organisation and is therefore tenant-scoped. */
@Entity
@Table(name = "recruiters")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Recruiter {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "full_name", nullable = false, length = 160)
    private String fullName;

    @Column(name = "official_email", nullable = false, unique = true, length = 320)
    private String officialEmail;

    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @Column(length = 20)
    private String mobile;

    @Column(name = "mobile_verified", nullable = false)
    private boolean mobileVerified;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(name = "recruiter_type", nullable = false, length = 16)
    @Builder.Default
    private RecruiterType recruiterType = RecruiterType.EMPLOYER;

    @Column(length = 160)
    private String location;

    @Column(length = 160)
    private String designation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organisation_id", nullable = false)
    private Organisation organisation;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

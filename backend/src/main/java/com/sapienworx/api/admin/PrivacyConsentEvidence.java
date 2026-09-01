package com.sapienworx.api.admin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Immutable evidence of the notice and purpose a person accepted or withdrew. */
@Entity
@Table(name = "privacy_consent_evidence")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrivacyConsentEvidence {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "subject_type", nullable = false, length = 24) private String subjectType;
    @Column(name = "subject_id", nullable = false) private UUID subjectId;
    @Column(nullable = false, length = 64) private String purpose;
    @Column(name = "lawful_basis", nullable = false, length = 64) private String lawfulBasis;
    @Column(name = "notice_version", nullable = false, length = 40) private String noticeVersion;
    @Column(name = "notice_language", nullable = false, length = 16) private String noticeLanguage;
    @Column(name = "affirmative_action", nullable = false) private boolean affirmativeAction;
    @Column(name = "recorded_at", nullable = false) private Instant recordedAt;
    @Column(name = "withdrawn_at") private Instant withdrawnAt;
}

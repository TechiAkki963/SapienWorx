package com.sapienworx.api.admin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PrivacyConsentEvidenceRepository extends JpaRepository<PrivacyConsentEvidence, UUID> {
    List<PrivacyConsentEvidence> findBySubjectIdOrderByRecordedAtAsc(UUID subjectId);
    PrivacyConsentEvidence findTopBySubjectIdAndPurposeAndWithdrawnAtIsNullOrderByRecordedAtDesc(UUID subjectId, String purpose);
}

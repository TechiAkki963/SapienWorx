package com.sapienworx.api.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    List<AuditLog> findByOrderByOccurredAtDesc(Pageable pageable);

    @Query("""
            select audit from AuditLog audit
            left join audit.candidate candidate
            where audit.actorId = :subjectId
               or audit.resourceId = :subjectId
               or candidate.id = :subjectId
            order by audit.occurredAt desc
            """)
    List<AuditLog> findUserActivity(@Param("subjectId") UUID subjectId, Pageable pageable);
}

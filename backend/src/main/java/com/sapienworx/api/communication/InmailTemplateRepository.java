package com.sapienworx.api.communication;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface InmailTemplateRepository extends JpaRepository<InmailTemplate, UUID> {
    List<InmailTemplate> findByRecruiter_IdOrderByUpdatedAtDesc(UUID recruiterId);
}

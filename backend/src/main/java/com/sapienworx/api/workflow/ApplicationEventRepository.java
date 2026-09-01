package com.sapienworx.api.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ApplicationEventRepository extends JpaRepository<ApplicationEvent, UUID> {
    List<ApplicationEvent> findByApplication_IdOrderByCreatedAtAsc(UUID applicationId);
    List<ApplicationEvent> findByApplication_IdOrderByCreatedAtDesc(UUID applicationId);
}

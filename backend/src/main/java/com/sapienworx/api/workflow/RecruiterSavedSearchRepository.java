package com.sapienworx.api.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RecruiterSavedSearchRepository extends JpaRepository<RecruiterSavedSearch, UUID> {
    List<RecruiterSavedSearch> findByRecruiter_IdOrderByUpdatedAtDesc(UUID recruiterId);
    Optional<RecruiterSavedSearch> findByIdAndRecruiter_Id(UUID id, UUID recruiterId);
}

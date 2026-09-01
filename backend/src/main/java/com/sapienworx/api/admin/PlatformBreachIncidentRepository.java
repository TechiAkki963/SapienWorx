package com.sapienworx.api.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PlatformBreachIncidentRepository extends JpaRepository<PlatformBreachIncident, UUID> {
    List<PlatformBreachIncident> findTop100ByOrderByDetectedAtDesc();
}

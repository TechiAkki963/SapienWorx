package com.sapienworx.api.recruiter;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RecruiterRepository extends JpaRepository<Recruiter, UUID> {
    Optional<Recruiter> findByOfficialEmail(String officialEmail);
    java.util.List<Recruiter> findByOrganisation_Id(UUID organisationId);
    java.util.List<Recruiter> findByOrganisation_IdOrderByFullNameAsc(UUID organisationId);
}

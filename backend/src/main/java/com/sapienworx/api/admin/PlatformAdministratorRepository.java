package com.sapienworx.api.admin;
import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface PlatformAdministratorRepository extends JpaRepository<PlatformAdministrator, UUID> { Optional<PlatformAdministrator> findByEmailIgnoreCase(String email); }

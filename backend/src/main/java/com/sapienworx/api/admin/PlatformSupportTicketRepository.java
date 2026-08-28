package com.sapienworx.api.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PlatformSupportTicketRepository extends JpaRepository<PlatformSupportTicket, UUID> {
    List<PlatformSupportTicket> findTop50ByOrderByUpdatedAtDesc();
}

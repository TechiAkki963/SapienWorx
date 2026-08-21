package com.sapienworx.api.application;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RecruiterNoteRepository extends JpaRepository<RecruiterNote, UUID> {
    List<RecruiterNote> findTop10ByApplication_IdOrderByUpdatedAtDesc(UUID applicationId);
}

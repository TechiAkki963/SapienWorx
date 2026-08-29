package com.sapienworx.api.knowledge;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KnowledgePostRepository extends JpaRepository<KnowledgePost, UUID> {
    List<KnowledgePost> findAllByOrderByUpdatedAtDesc();
    List<KnowledgePost> findByStatusOrderByPublishedAtDesc(KnowledgePostStatus status);
    Optional<KnowledgePost> findBySlugIgnoreCaseAndStatus(String slug, KnowledgePostStatus status);
    boolean existsBySlugIgnoreCase(String slug);
    boolean existsBySlugIgnoreCaseAndIdNot(String slug, UUID id);
}

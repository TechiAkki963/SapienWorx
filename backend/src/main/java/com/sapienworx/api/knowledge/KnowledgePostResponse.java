package com.sapienworx.api.knowledge;

import java.time.Instant;
import java.util.UUID;

public record KnowledgePostResponse(
        UUID id,
        String slug,
        String title,
        String category,
        String excerpt,
        String body,
        String heroTone,
        boolean featured,
        KnowledgePostStatus status,
        String authorName,
        String lastEditorialNote,
        int readingMinutes,
        Instant createdAt,
        Instant updatedAt,
        Instant publishedAt
) {
    static KnowledgePostResponse from(KnowledgePost post) {
        return new KnowledgePostResponse(post.getId(), post.getSlug(), post.getTitle(), post.getCategory(),
                post.getExcerpt(), post.getBody(), post.getHeroTone(), post.isFeatured(), post.getStatus(),
                post.getAuthorName(), post.getLastEditorialNote(), KnowledgePostService.readingMinutes(post.getBody()),
                post.getCreatedAt(), post.getUpdatedAt(), post.getPublishedAt());
    }
}

package com.sapienworx.api.knowledge;

import com.sapienworx.api.admin.MasterAdminRequests;
import com.sapienworx.api.admin.PlatformAdminRole;
import com.sapienworx.api.admin.PlatformAdministrator;
import com.sapienworx.api.admin.PlatformAdministratorRepository;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import com.sapienworx.api.audit.AuditAction;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KnowledgePostService {
    private static final Set<String> TONES = Set.of("navy", "blue", "purple", "sage", "terracotta");

    private final KnowledgePostRepository posts;
    private final PlatformAdministratorRepository administrators;
    private final PlatformAccessPolicy accessPolicy;

    @Transactional(readOnly = true)
    public List<KnowledgePostResponse> publicPosts() {
        accessPolicy.requirePublicPlatformAvailable();
        return posts.findByStatusOrderByPublishedAtDesc(KnowledgePostStatus.PUBLISHED).stream()
                .map(KnowledgePostResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public KnowledgePostResponse publicPost(String slug) {
        accessPolicy.requirePublicPlatformAvailable();
        return posts.findBySlugIgnoreCaseAndStatus(normalized(slug), KnowledgePostStatus.PUBLISHED)
                .map(KnowledgePostResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published article was not found."));
    }

    @Transactional(readOnly = true)
    public List<KnowledgePostResponse> adminPosts(UUID actor) {
        requireAdministrator(actor);
        return posts.findAllByOrderByUpdatedAtDesc().stream().map(KnowledgePostResponse::from).toList();
    }

    @Transactional
    @AuditAction(action = "KNOWLEDGE_POST_DRAFT_CREATED", resourceType = "KNOWLEDGE_POST")
    public KnowledgePostResponse create(UUID actor, MasterAdminRequests.KnowledgePostUpsertRequest request) {
        PlatformAdministrator administrator = requireEditor(actor);
        String slug = slugify(blank(request.slug()) ? request.title() : request.slug());
        if (posts.existsBySlugIgnoreCase(slug)) throw conflict("That article URL is already in use.");
        KnowledgePost post = KnowledgePost.builder()
                .slug(slug)
                .authorAdminId(actor)
                .authorName(administrator.getDisplayName())
                .status(KnowledgePostStatus.DRAFT)
                .build();
        apply(post, request);
        return KnowledgePostResponse.from(posts.save(post));
    }

    @Transactional
    @AuditAction(action = "KNOWLEDGE_POST_UPDATED", resourceType = "KNOWLEDGE_POST", resourceIdArgumentIndex = 1)
    public KnowledgePostResponse update(UUID actor, UUID postId, MasterAdminRequests.KnowledgePostUpsertRequest request) {
        requireEditor(actor);
        KnowledgePost post = requirePost(postId);
        String slug = slugify(blank(request.slug()) ? request.title() : request.slug());
        if (posts.existsBySlugIgnoreCaseAndIdNot(slug, postId)) throw conflict("That article URL is already in use.");
        post.setSlug(slug);
        apply(post, request);
        return KnowledgePostResponse.from(posts.save(post));
    }

    @Transactional
    @AuditAction(action = "KNOWLEDGE_POST_PUBLISHED", resourceType = "KNOWLEDGE_POST", resourceIdArgumentIndex = 1)
    public KnowledgePostResponse publish(UUID actor, UUID postId, MasterAdminRequests.KnowledgePostDecisionRequest request) {
        requireEditor(actor);
        KnowledgePost post = requirePost(postId);
        post.setLastEditorialNote(decisionReason(request));
        post.setStatus(KnowledgePostStatus.PUBLISHED);
        if (post.getPublishedAt() == null) post.setPublishedAt(Instant.now());
        return KnowledgePostResponse.from(posts.save(post));
    }

    @Transactional
    @AuditAction(action = "KNOWLEDGE_POST_ARCHIVED", resourceType = "KNOWLEDGE_POST", resourceIdArgumentIndex = 1)
    public KnowledgePostResponse archive(UUID actor, UUID postId, MasterAdminRequests.KnowledgePostDecisionRequest request) {
        requireEditor(actor);
        KnowledgePost post = requirePost(postId);
        post.setLastEditorialNote(decisionReason(request));
        post.setStatus(KnowledgePostStatus.ARCHIVED);
        post.setFeatured(false);
        return KnowledgePostResponse.from(posts.save(post));
    }

    private void apply(KnowledgePost post, MasterAdminRequests.KnowledgePostUpsertRequest request) {
        String title = required(request.title(), "Article title", 10, 180);
        String category = required(request.category(), "Category", 2, 80);
        String excerpt = required(request.excerpt(), "Summary", 30, 420);
        String body = required(request.body(), "Article body", 80, 30_000);
        String tone = normalized(request.heroTone()).toLowerCase(Locale.ROOT);
        if (!TONES.contains(tone)) throw invalid("Choose a supported article colour.");
        post.setTitle(title);
        post.setCategory(category);
        post.setExcerpt(excerpt);
        post.setBody(body);
        post.setHeroTone(tone);
        post.setFeatured(Boolean.TRUE.equals(request.featured()));
    }

    private PlatformAdministrator requireEditor(UUID actor) {
        PlatformAdministrator administrator = requireAdministrator(actor);
        PlatformAdminRole role = administrator.getAdminRole() == null ? PlatformAdminRole.OWNER : administrator.getAdminRole();
        if (!mayEdit(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your Master Access role cannot manage Knowledge Hub articles.");
        }
        return administrator;
    }

    static boolean mayEdit(PlatformAdminRole role) {
        return role == PlatformAdminRole.OWNER || role == PlatformAdminRole.OPERATIONS;
    }

    private PlatformAdministrator requireAdministrator(UUID actor) {
        return administrators.findById(actor).filter(PlatformAdministrator::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Active Master Access is required."));
    }

    private KnowledgePost requirePost(UUID postId) {
        return posts.findById(postId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Knowledge Hub article was not found."));
    }

    private String decisionReason(MasterAdminRequests.KnowledgePostDecisionRequest request) {
        return required(request == null ? null : request.reason(), "Editorial note", 10, 500);
    }

    private String required(String value, String label, int minimum, int maximum) {
        String result = normalized(value);
        if (result.length() < minimum || result.length() > maximum) {
            throw invalid(label + " must contain between " + minimum + " and " + maximum + " characters.");
        }
        return result;
    }

    static String slugify(String value) {
        String result = Normalizer.normalize(normalized(value), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (result.length() > 160) result = result.substring(0, 160).replaceAll("-$", "");
        if (result.length() < 3) throw invalid("Article URL must contain at least three letters or numbers.");
        return result;
    }

    static int readingMinutes(String body) {
        String normalized = normalized(body);
        if (normalized.isEmpty()) return 1;
        return Math.max(1, (int) Math.ceil(normalized.split("\\s+").length / 220d));
    }

    private static String normalized(String value) { return value == null ? "" : value.trim(); }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message); }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
}

package com.sapienworx.api.knowledge;

import com.sapienworx.api.admin.MasterAdminRequests;
import com.sapienworx.api.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/master/knowledge-posts")
@RequiredArgsConstructor
public class AdminKnowledgeController {
    private final KnowledgePostService service;

    @GetMapping
    public List<KnowledgePostResponse> posts(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.adminPosts(user.userId());
    }

    @PostMapping
    public KnowledgePostResponse create(@AuthenticationPrincipal AuthenticatedUser user,
                                        @RequestBody MasterAdminRequests.KnowledgePostUpsertRequest request) {
        return service.create(user.userId(), request);
    }

    @PutMapping("/{postId}")
    public KnowledgePostResponse update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID postId,
                                        @RequestBody MasterAdminRequests.KnowledgePostUpsertRequest request) {
        return service.update(user.userId(), postId, request);
    }

    @PostMapping("/{postId}/publish")
    public KnowledgePostResponse publish(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID postId,
                                         @RequestBody MasterAdminRequests.KnowledgePostDecisionRequest request) {
        return service.publish(user.userId(), postId, request);
    }

    @PostMapping("/{postId}/archive")
    public KnowledgePostResponse archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID postId,
                                         @RequestBody MasterAdminRequests.KnowledgePostDecisionRequest request) {
        return service.archive(user.userId(), postId, request);
    }
}

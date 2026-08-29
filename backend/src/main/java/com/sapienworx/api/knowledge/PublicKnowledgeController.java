package com.sapienworx.api.knowledge;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/knowledge-posts")
@RequiredArgsConstructor
public class PublicKnowledgeController {
    private final KnowledgePostService service;

    @GetMapping
    public List<KnowledgePostResponse> posts() { return service.publicPosts(); }

    @GetMapping("/{slug}")
    public KnowledgePostResponse post(@PathVariable String slug) { return service.publicPost(slug); }
}

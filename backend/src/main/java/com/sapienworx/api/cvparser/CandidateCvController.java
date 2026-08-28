package com.sapienworx.api.cvparser;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/candidate/cv")
public class CandidateCvController {
    private static final Set<String> ACCEPTED_TYPES = Set.of("application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword");
    private final FileSystemCvDocumentStorage storage;
    private final CvParserMessagePublisher parserMessagePublisher;
    private final PlatformAccessPolicy platformAccessPolicy;
    private final long maximumDocumentBytes;

    public CandidateCvController(
            FileSystemCvDocumentStorage storage,
            CvParserMessagePublisher parserMessagePublisher,
            PlatformAccessPolicy platformAccessPolicy,
            @Value("${app.cv-parser.maximum-document-bytes:20971520}") long maximumDocumentBytes
    ) {
        this.storage = storage;
        this.parserMessagePublisher = parserMessagePublisher;
        this.platformAccessPolicy = platformAccessPolicy;
        this.maximumDocumentBytes = maximumDocumentBytes;
    }

    @PostMapping
    public CvUploadResponse upload(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam("file") MultipartFile file) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        platformAccessPolicy.requireCvParsingEnabled();
        if (file.isEmpty() || file.getSize() > maximumDocumentBytes || !accepted(file)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Upload a PDF, DOCX or TXT CV smaller than the configured limit.");
        }
        try {
            String key = storage.store(user.userId(), file);
            ParserPayload payload = ParserPayload.candidate(user.userId(), key, file.getContentType());
            parserMessagePublisher.queueCandidateOnboarding(payload);
            return new CvUploadResponse(payload.requestId(), "QUEUED");
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "We could not securely store this CV.");
        }
    }

    private boolean accepted(MultipartFile file) {
        String contentType = file.getContentType();
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(java.util.Locale.ROOT);
        return ACCEPTED_TYPES.contains(contentType) || name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt");
    }
}

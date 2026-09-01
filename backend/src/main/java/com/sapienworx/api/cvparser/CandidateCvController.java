package com.sapienworx.api.cvparser;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
public class CandidateCvController {
    private static final Set<String> ACCEPTED_TYPES = Set.of("application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword");
    private final CvDocumentStorage storage;
    private final CvParserMessagePublisher parserMessagePublisher;
    private final PlatformAccessPolicy platformAccessPolicy;
    private final long maximumDocumentBytes;

    public CandidateCvController(
            CvDocumentStorage storage,
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
        if (file.isEmpty() || file.getSize() > maximumDocumentBytes) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Upload a PDF, DOCX or TXT CV smaller than the configured limit.");
        }
        try {
            if (!accepted(file)) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Upload a PDF, DOCX or TXT CV smaller than the configured limit.");
            }
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "We could not validate this CV file.");
        }
        String storedKey = null;
        try {
            storedKey = storage.store(user.userId(), file);
            ParserPayload payload = ParserPayload.candidate(user.userId(), storedKey, file.getContentType());
            parserMessagePublisher.queueCandidateOnboarding(payload);
            return new CvUploadResponse(payload.requestId(), "QUEUED");
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "We could not securely store this CV.");
        } catch (RuntimeException exception) {
            if (storedKey != null) {
                try { storage.delete(storedKey); }
                catch (IOException cleanupFailure) { log.error("CV upload rollback failed for an unpublished object key"); }
            }
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Your CV was not queued. No profile change was made; please try again.");
        }
    }

    private boolean accepted(MultipartFile file) throws IOException {
        String contentType = file.getContentType();
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(java.util.Locale.ROOT);
        if (!(ACCEPTED_TYPES.contains(contentType) || name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".doc") || name.endsWith(".txt"))) return false;
        byte[] signature = file.getInputStream().readNBytes(8);
        if (name.endsWith(".pdf") || "application/pdf".equals(contentType)) return startsWith(signature, new byte[]{'%', 'P', 'D', 'F', '-'});
        if (name.endsWith(".docx") || "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(contentType)) return startsWith(signature, new byte[]{'P', 'K', 3, 4});
        if (name.endsWith(".doc") || "application/msword".equals(contentType)) return startsWith(signature, new byte[]{(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0});
        for (byte value : signature) if (value == 0) return false;
        return true;
    }

    private boolean startsWith(byte[] value, byte[] prefix) {
        if (value.length < prefix.length) return false;
        for (int index = 0; index < prefix.length; index++) if (value[index] != prefix[index]) return false;
        return true;
    }
}

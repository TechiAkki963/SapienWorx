package com.sapienworx.api.cvparser;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/** Local private storage adapter for development. Production can replace this bean with an S3-compatible adapter. */
@Component
@ConditionalOnProperty(name = "app.cv-storage.type", havingValue = "filesystem", matchIfMissing = true)
public class FileSystemCvDocumentStorage implements CvDocumentStorage {
    private final Path root;

    public FileSystemCvDocumentStorage(@Value("${app.cv-storage.root:./private-cv}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    @Override
    public String store(UUID candidateId, MultipartFile file) throws IOException {
        String extension = extension(file.getOriginalFilename());
        String key = candidateId + "/" + UUID.randomUUID() + extension;
        Path target = resolved(key);
        Files.createDirectories(target.getParent());
        try (InputStream input = file.getInputStream()) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }
        return key;
    }

    @Override
    public InputStream open(String fileKey) throws IOException { return Files.newInputStream(resolved(fileKey)); }

    @Override
    public void delete(String fileKey) throws IOException { Files.deleteIfExists(resolved(fileKey)); }

    public void deleteCandidate(UUID candidateId) throws IOException {
        Path candidateRoot = resolved(candidateId.toString());
        if (!Files.exists(candidateRoot)) return;
        try (var paths = Files.walk(candidateRoot)) {
            paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                try { Files.deleteIfExists(path); } catch (IOException exception) { throw new java.io.UncheckedIOException(exception); }
            });
        } catch (java.io.UncheckedIOException exception) { throw exception.getCause(); }
    }

    private Path resolved(String key) {
        Path resolved = root.resolve(key).normalize();
        if (!resolved.startsWith(root)) throw new IllegalArgumentException("Invalid document key.");
        return resolved;
    }
    private String extension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot).toLowerCase(java.util.Locale.ROOT);
    }
}

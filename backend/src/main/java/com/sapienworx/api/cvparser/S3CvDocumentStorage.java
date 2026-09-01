package com.sapienworx.api.cvparser;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectTaggingRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/** Private S3 storage. Objects remain quarantined until GuardDuty marks them clean. */
@Component
@ConditionalOnProperty(name = "app.cv-storage.type", havingValue = "s3")
public class S3CvDocumentStorage implements CvDocumentStorage {
    private static final String MALWARE_SCAN_TAG = "GuardDutyMalwareScanStatus";
    private static final String CLEAN = "NO_THREATS_FOUND";

    private final S3Client s3;
    private final String bucket;
    private final String quarantinePrefix;
    private final String kmsKeyId;
    private final boolean requireCleanScanTag;

    public S3CvDocumentStorage(
            S3Client s3,
            @Value("${app.cv-storage.s3.bucket}") String bucket,
            @Value("${app.cv-storage.s3.quarantine-prefix:quarantine/candidates}") String quarantinePrefix,
            @Value("${app.cv-storage.s3.kms-key-id:}") String kmsKeyId,
            @Value("${app.cv-storage.s3.require-clean-scan-tag:false}") boolean requireCleanScanTag
    ) {
        if (bucket == null || bucket.isBlank()) throw new IllegalStateException("CV_STORAGE_S3_BUCKET is required for S3 storage.");
        this.s3 = s3;
        this.bucket = bucket;
        this.quarantinePrefix = trimSlashes(quarantinePrefix);
        this.kmsKeyId = kmsKeyId == null ? "" : kmsKeyId.trim();
        this.requireCleanScanTag = requireCleanScanTag;
    }

    @Override
    public String store(UUID candidateId, MultipartFile file) throws IOException {
        String key = quarantinePrefix + "/" + candidateId + "/" + UUID.randomUUID() + extension(file.getOriginalFilename());
        PutObjectRequest.Builder request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(file.getContentType())
                .serverSideEncryption(ServerSideEncryption.AWS_KMS);
        if (!kmsKeyId.isBlank()) request.ssekmsKeyId(kmsKeyId);
        try (InputStream input = file.getInputStream()) {
            s3.putObject(request.build(), RequestBody.fromInputStream(input, file.getSize()));
            return key;
        } catch (RuntimeException exception) {
            throw new IOException("Private CV storage failed.", exception);
        }
    }

    @Override
    public InputStream open(String fileKey) throws IOException {
        validateKey(fileKey);
        try {
            if (requireCleanScanTag) {
                Optional<String> scanStatus = scanStatus(fileKey);
                if (scanStatus.isEmpty()) {
                    throw new CvDocumentQuarantinedException("The CV is still quarantined pending a clean malware scan.");
                }
                if (!CLEAN.equals(scanStatus.get())) {
                    throw new CvDocumentRejectedException("The CV did not pass the required malware scan.");
                }
            }
            ResponseInputStream<?> stream = s3.getObject(GetObjectRequest.builder().bucket(bucket).key(fileKey).build());
            return stream;
        } catch (IOException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new IOException("Private CV retrieval failed.", exception);
        }
    }

    @Override
    public void delete(String fileKey) throws IOException {
        validateKey(fileKey);
        try {
            s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(fileKey).build());
        } catch (RuntimeException exception) {
            throw new IOException("Private CV deletion failed.", exception);
        }
    }

    private Optional<String> scanStatus(String key) {
        return s3.getObjectTagging(GetObjectTaggingRequest.builder().bucket(bucket).key(key).build())
                .tagSet().stream()
                .filter(tag -> MALWARE_SCAN_TAG.equals(tag.key()))
                .map(software.amazon.awssdk.services.s3.model.Tag::value)
                .findFirst();
    }

    private void validateKey(String key) {
        if (key == null || key.isBlank() || key.startsWith("/") || key.contains("..") || !key.startsWith(quarantinePrefix + "/")) {
            throw new IllegalArgumentException("Invalid private CV key.");
        }
    }

    private String extension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot).toLowerCase(Locale.ROOT);
    }

    private String trimSlashes(String value) {
        String result = value == null ? "" : value.trim();
        while (result.startsWith("/")) result = result.substring(1);
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        if (result.isBlank()) throw new IllegalStateException("CV storage quarantine prefix is required.");
        return result;
    }
}

package com.sapienworx.api.cvparser;

import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;

/**
 * Object-storage boundary. Production adapters may use S3 or another
 * S3-compatible provider, but queue messages retain only opaque file keys.
 */
public interface CvDocumentStorage {
    String store(UUID candidateId, MultipartFile file) throws IOException;

    InputStream open(String fileKey) throws IOException;

    /** Removes the private source document as part of a verified erasure request. */
    void delete(String fileKey) throws IOException;
}

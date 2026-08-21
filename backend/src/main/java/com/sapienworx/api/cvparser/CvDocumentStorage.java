package com.sapienworx.api.cvparser;

import java.io.IOException;
import java.io.InputStream;

/**
 * Object-storage boundary. Production adapters may use S3 or another
 * S3-compatible provider, but queue messages retain only opaque file keys.
 */
public interface CvDocumentStorage {
    InputStream open(String fileKey) throws IOException;
}

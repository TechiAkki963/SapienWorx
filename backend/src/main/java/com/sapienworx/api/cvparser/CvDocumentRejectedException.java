package com.sapienworx.api.cvparser;

import java.io.IOException;

/** A terminal security state: an uploaded document must not be opened. */
public class CvDocumentRejectedException extends IOException {
    public CvDocumentRejectedException(String message) {
        super(message);
    }
}

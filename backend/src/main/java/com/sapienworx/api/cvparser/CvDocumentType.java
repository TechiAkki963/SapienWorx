package com.sapienworx.api.cvparser;

import java.util.Locale;

enum CvDocumentType {
    PDF,
    DOCX,
    TEXT;

    static CvDocumentType from(String fileKey, String contentType) {
        String normalisedContentType = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT).trim();
        if ("application/pdf".equals(normalisedContentType)) {
            return PDF;
        }
        if ("application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(normalisedContentType)) {
            return DOCX;
        }
        if ("text/plain".equals(normalisedContentType)) {
            return TEXT;
        }

        String normalised = fileKey == null ? "" : fileKey.toLowerCase(Locale.ROOT);
        if (normalised.endsWith(".pdf")) {
            return PDF;
        }
        if (normalised.endsWith(".docx")) {
            return DOCX;
        }
        if (normalised.endsWith(".txt")) {
            return TEXT;
        }
        throw new UnsupportedCvDocumentException("Only PDF, DOCX, and TXT CV files are supported.");
    }
}

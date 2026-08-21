package com.sapienworx.api.cvparser;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Safely extracts text without retaining the original document after processing. */
@Service
public class DocumentExtractionService {

    private final int maximumDocumentBytes;

    public DocumentExtractionService(@Value("${app.cv-parser.maximum-document-bytes:20971520}") int maximumDocumentBytes) {
        if (maximumDocumentBytes <= 0) {
            throw new IllegalArgumentException("CV document size limit must be positive.");
        }
        this.maximumDocumentBytes = maximumDocumentBytes;
    }

    public String extractText(CvDocumentType documentType, InputStream documentStream) {
        try {
            byte[] documentBytes = readDocumentWithinLimit(documentStream);
            return switch (documentType) {
                case PDF -> extractTextFromPdf(documentBytes);
                case DOCX -> extractTextFromDocx(documentBytes);
                case TEXT -> new String(documentBytes, StandardCharsets.UTF_8);
            };
        } catch (IOException exception) {
            throw new DocumentExtractionException("The CV document could not be read.", exception);
        }
    }

    private String extractTextFromPdf(byte[] documentBytes) throws IOException {
        try (PDDocument document = Loader.loadPDF(documentBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(document);
        }
    }

    private String extractTextFromDocx(byte[] documentBytes) throws IOException {
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(documentBytes));
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }

    private byte[] readDocumentWithinLimit(InputStream stream) throws IOException {
        byte[] documentBytes = stream.readNBytes(maximumDocumentBytes + 1);
        if (documentBytes.length > maximumDocumentBytes) {
            throw new IOException("The CV document exceeds the configured size limit.");
        }
        return documentBytes;
    }
}

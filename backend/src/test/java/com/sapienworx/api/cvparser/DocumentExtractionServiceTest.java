package com.sapienworx.api.cvparser;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DocumentExtractionServiceTest {

    @Test
    void extractsUtf8TextWithoutPersistingTheSourceDocument() {
        DocumentExtractionService service = new DocumentExtractionService(100);

        String extracted = service.extractText(
                CvDocumentType.TEXT,
                new ByteArrayInputStream("Candidate profile".getBytes(StandardCharsets.UTF_8))
        );

        assertThat(extracted).isEqualTo("Candidate profile");
    }

    @Test
    void rejectsDocumentsAboveTheConfiguredLimit() {
        DocumentExtractionService service = new DocumentExtractionService(4);

        assertThatThrownBy(() -> service.extractText(
                CvDocumentType.TEXT,
                new ByteArrayInputStream("12345".getBytes(StandardCharsets.UTF_8))
        )).isInstanceOf(DocumentExtractionException.class);
    }
}

package com.sapienworx.api.cvparser;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectTaggingRequest;
import software.amazon.awssdk.services.s3.model.GetObjectTaggingResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.Tag;

import java.io.IOException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class S3CvDocumentStorageTest {
    @Test
    void storesDocumentsUnderTheCandidateQuarantinePrefixWithKms() throws Exception {
        S3Client s3 = mock(S3Client.class);
        S3CvDocumentStorage storage = new S3CvDocumentStorage(s3, "private-cv", "quarantine/candidates", "kms-key", true);
        UUID candidateId = UUID.randomUUID();

        String key = storage.store(candidateId, new MockMultipartFile("file", "resume.pdf", "application/pdf", "safe".getBytes()));

        assertThat(key).startsWith("quarantine/candidates/" + candidateId + "/").endsWith(".pdf");
        var request = org.mockito.ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3).putObject(request.capture(), any(software.amazon.awssdk.core.sync.RequestBody.class));
        assertThat(request.getValue().ssekmsKeyId()).isEqualTo("kms-key");
        assertThat(request.getValue().serverSideEncryptionAsString()).isEqualTo("aws:kms");
    }

    @Test
    void refusesToOpenAnObjectWithoutTheGuardDutyCleanTag() {
        S3Client s3 = mock(S3Client.class);
        when(s3.getObjectTagging(any(GetObjectTaggingRequest.class))).thenReturn(GetObjectTaggingResponse.builder().build());
        S3CvDocumentStorage storage = new S3CvDocumentStorage(s3, "private-cv", "quarantine/candidates", "kms-key", true);

        assertThatThrownBy(() -> storage.open("quarantine/candidates/user/resume.pdf"))
                .isInstanceOf(CvDocumentQuarantinedException.class)
                .hasMessageContaining("quarantined");
    }

    @Test
    void permanentlyRejectsAnObjectThatGuardDutyFlags() {
        S3Client s3 = mock(S3Client.class);
        when(s3.getObjectTagging(any(GetObjectTaggingRequest.class))).thenReturn(GetObjectTaggingResponse.builder()
                .tagSet(Tag.builder().key("GuardDutyMalwareScanStatus").value("THREATS_FOUND").build()).build());
        S3CvDocumentStorage storage = new S3CvDocumentStorage(s3, "private-cv", "quarantine/candidates", "kms-key", true);

        assertThatThrownBy(() -> storage.open("quarantine/candidates/user/resume.pdf"))
                .isInstanceOf(CvDocumentRejectedException.class)
                .hasMessageContaining("did not pass");
    }

    @Test
    void rejectsKeysOutsideThePrivateCvNamespace() {
        S3CvDocumentStorage storage = new S3CvDocumentStorage(mock(S3Client.class), "private-cv", "quarantine/candidates", "kms-key", true);

        assertThatThrownBy(() -> storage.delete("../public/other.pdf"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

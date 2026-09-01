package com.sapienworx.api.offer;

import com.sapienworx.api.job.WorkplaceModel;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OfferPdfRendererTest {
    @Test
    void longEmploymentTermsContinueOntoAdditionalPages() throws Exception {
        Offer offer = mock(Offer.class, RETURNS_DEEP_STUBS);
        when(offer.getOrganisation().getName()).thenReturn("Sapienworx Test Organisation");
        when(offer.getApplication().getCandidate().getFullName()).thenReturn("Taylor Candidate");
        when(offer.getCurrentVersion()).thenReturn(3);
        when(offer.getCandidateMessage()).thenReturn("We are delighted to invite you to join the team.");
        when(offer.getDesignation()).thenReturn("Senior Platform Engineer");
        when(offer.getJoiningDate()).thenReturn(LocalDate.now().plusMonths(2));
        when(offer.getWorkplaceModel()).thenReturn(WorkplaceModel.HYBRID);
        when(offer.getProbationMonths()).thenReturn(6);
        when(offer.isNoticeBuyout()).thenReturn(true);
        when(offer.getCurrency()).thenReturn("INR");
        when(offer.getAnnualFixedAmount()).thenReturn(new BigDecimal("2400000"));
        when(offer.getAnnualVariableAmount()).thenReturn(new BigDecimal("300000"));
        when(offer.getJoiningBonus()).thenReturn(new BigDecimal("100000"));
        when(offer.getRetentionBonus()).thenReturn(BigDecimal.ZERO);
        when(offer.getOtherCompensation()).thenReturn("Medical cover and learning allowance.");
        when(offer.getTermsText()).thenReturn("Detailed employment condition. ".repeat(400));
        when(offer.getExpiresAt()).thenReturn(Instant.now().plusSeconds(604800));
        when(offer.getStatus()).thenReturn(OfferStatus.SENT);

        byte[] result = new OfferPdfRenderer().render(offer);

        try (PDDocument document = Loader.loadPDF(result)) {
            assertThat(document.getNumberOfPages()).isGreaterThan(1);
        }
    }
}

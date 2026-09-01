package com.sapienworx.api.offer;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class OfferPdfRenderer {
    private static final PDType1Font REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDType1Font BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

    public byte[] render(Offer offer) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            try (DocumentWriter writer = new DocumentWriter(document)) {
                writer.text(BOLD, 20, 54, offer.getOrganisation().getName());
                writer.gap(4);
                writer.text(REGULAR, 10, 54, "Sapienworx secure offer · Version " + offer.getCurrentVersion());
                writer.gap(28);
                writer.text(BOLD, 16, 54, "Offer of employment");
                writer.gap(14);
                writer.paragraph("Dear " + offer.getApplication().getCandidate().getFullName() + ",", 54, 78);
                writer.gap(8);
                writer.paragraph(offer.getCandidateMessage().isBlank()
                        ? "We are pleased to offer you the position described below."
                        : offer.getCandidateMessage(), 54, 78);
                writer.gap(14);
                writer.section("Role details");
                writer.row("Designation", offer.getDesignation());
                writer.row("Joining date", offer.getJoiningDate().format(DateTimeFormatter.ofPattern("d MMMM uuuu")));
                writer.row("Workplace", pretty(offer.getWorkplaceModel().name()));
                writer.row("Probation", offer.getProbationMonths() == 0 ? "Not applicable" : offer.getProbationMonths() + " months");
                writer.row("Notice buyout", offer.isNoticeBuyout() ? "Included" : "Not included");
                writer.gap(10);
                writer.section("Compensation");
                writer.row("Annual fixed", money(offer.getCurrency(), offer.getAnnualFixedAmount()));
                writer.row("Annual variable", money(offer.getCurrency(), offer.getAnnualVariableAmount()));
                writer.row("Joining bonus", money(offer.getCurrency(), offer.getJoiningBonus()));
                writer.row("Retention bonus", money(offer.getCurrency(), offer.getRetentionBonus()));
                if (!offer.getOtherCompensation().isBlank()) {
                    writer.gap(4);
                    writer.paragraph("Additional compensation: " + offer.getOtherCompensation(), 54, 78);
                }
                writer.gap(10);
                writer.section("Terms");
                writer.paragraph(offer.getTermsText().isBlank() ? "Employment is subject to the organisation's applicable policies and successful joining checks." : offer.getTermsText(), 54, 78);
                String expiry = DateTimeFormatter.ofPattern("d MMM uuuu, h:mm a z").withZone(ZoneId.of("Asia/Kolkata")).format(offer.getExpiresAt());
                writer.gap(18);
                writer.paragraph("This offer is valid until " + expiry + ". Current status: " + pretty(offer.getStatus().name()) + ".", 54, 78);
            }
            document.save(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("The offer document could not be prepared.", exception);
        }
    }

    private final class DocumentWriter implements AutoCloseable {
        private static final float TOP = 790;
        private static final float BOTTOM = 54;

        private final PDDocument document;
        private PDPageContentStream canvas;
        private float y;

        private DocumentWriter(PDDocument document) throws IOException {
            this.document = document;
            newPage();
        }

        private void newPage() throws IOException {
            if (canvas != null) canvas.close();
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            canvas = new PDPageContentStream(document, page);
            y = TOP;
        }

        private void ensure(float height) throws IOException {
            if (y - height < BOTTOM) newPage();
        }

        private void gap(float height) throws IOException {
            ensure(height);
            y -= height;
        }

        private void text(PDType1Font font, float size, float x, String value) throws IOException {
            ensure(size + 7);
            draw(font, size, x, y, value);
            y -= size + 7;
        }

        private void section(String value) throws IOException {
            ensure(29);
            text(BOLD, 12, 54, value);
        }

        private void row(String label, String value) throws IOException {
            List<String> valueLines = wrap(value, 58);
            ensure(Math.max(17, valueLines.size() * 17));
            draw(BOLD, 10, 54, y, label);
            for (String line : valueLines) {
                draw(REGULAR, 10, 190, y, line);
                y -= 17;
            }
        }

        private void paragraph(String value, float x, int lineLength) throws IOException {
            for (String line : wrap(value, lineLength)) text(REGULAR, 10, x, line);
        }

        private void draw(PDType1Font font, float size, float x, float baseline, String value) throws IOException {
            canvas.beginText();
            canvas.setFont(font, size);
            canvas.newLineAtOffset(x, baseline);
            canvas.showText(pdfSafe(value));
            canvas.endText();
        }

        @Override
        public void close() throws IOException {
            if (canvas != null) canvas.close();
        }
    }
    private List<String> wrap(String value, int limit) {
        List<String> lines = new ArrayList<>();
        for (String paragraph : value.replace('\r', ' ').split("\\n")) {
            StringBuilder line = new StringBuilder();
            for (String word : paragraph.strip().split("\\s+")) {
                if (line.length() > 0 && line.length() + word.length() + 1 > limit) { lines.add(line.toString()); line.setLength(0); }
                if (line.length() > 0) line.append(' ');
                line.append(word);
            }
            if (!line.isEmpty()) lines.add(line.toString());
        }
        return lines.isEmpty() ? List.of("") : lines;
    }
    private String money(String currency, BigDecimal value) { return currency + " " + NumberFormat.getNumberInstance(Locale.forLanguageTag("en-IN")).format(value); }
    private String pretty(String value) { String result = value.toLowerCase(Locale.ROOT).replace('_', ' '); return Character.toUpperCase(result.charAt(0)) + result.substring(1); }
    private String pdfSafe(String value) { return value == null ? "" : value.replace('₹', 'R').replace('–', '-').replace('—', '-').replace('’', '\''); }
}

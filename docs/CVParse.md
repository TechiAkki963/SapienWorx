# Master Architecture Prompt: Deterministic CV Parsing Engine

**Objective:** Replace the stubbed RabbitMQ worker logic with a production-ready deterministic parsing engine. The system must utilise Apache PDFBox and Apache POI to extract raw text, and subsequently apply strict Regex and rule-based heuristics to map the text to our structured Candidate JSON schema.

---

## 1. Maven Dependencies

The backend team must add the following industry-standard document processing libraries to the `pom.xml`.

\`\`\`xml

<!-- Apache PDFBox for PDF extraction -->
<dependency>
    <groupId>org.apache.pdfbox</groupId>
    <artifactId>pdfbox</artifactId>
    <version>3.0.1</version>
</dependency>

<!-- Apache POI for DOCX extraction -->
<dependency>
    <groupId>org.apache.poi</groupId>
    <artifactId>poi-ooxml</artifactId>
    <version>5.2.5</version>
</dependency>
\`\`\`

---

## 2. The Text Extraction Service

This service strictly handles the I/O operations, safely pulling the raw text from the binary file formats.

\`\`\`java
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;

import java.io.InputStream;

@Service
public class DocumentExtractionService {

    public String extractTextFromPdf(InputStream pdfStream) throws Exception {
        try (PDDocument document = PDDocument.load(pdfStream)) {
            PDFTextStripper stripper = new PDFTextStripper();
            // Sort by position to maintain reading order in complex column layouts
            stripper.setSortByPosition(true);
            return stripper.getText(document);
        }
    }

    public String extractTextFromDocx(InputStream docxStream) throws Exception {
        try (XWPFDocument document = new XWPFDocument(docxStream);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }

}
\`\`\`

---

## 3. The Deterministic Mapping Service (Regex & Heuristics)

This service applies strict, predictable rules to map the unstructured raw text into our defined `CandidateProfile` DTO. It must never guess; if a field cannot be deterministically found, it must be flagged in the warnings array for the candidate to review manually.

\`\`\`java
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class DeterministicParsingService {

    // Standard RFC 5322 compliant email regex
    private static final Pattern EMAIL_PATTERN = Pattern.compile("(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}");
    // International phone number matching (simplified)
    private static final Pattern PHONE_PATTERN = Pattern.compile("(\\+?\\d{1,3}[- .]?\\(?(?:\\d{2,3})\\)?[- .]?\\d\\d\\d[- .]?\\d\\d\\d\\d)");

    public ParsedProfileDto parseRawText(String rawText) {
        ParsedProfileDto profile = new ParsedProfileDto();
        List<String> warnings = new ArrayList<>();

        // 1. Extract Email
        Matcher emailMatcher = EMAIL_PATTERN.matcher(rawText);
        if (emailMatcher.find()) {
            profile.setEmail(emailMatcher.group());
        } else {
            warnings.add("Email address not found. Please enter manually.");
        }

        // 2. Extract Phone Number
        Matcher phoneMatcher = PHONE_PATTERN.matcher(rawText);
        if (phoneMatcher.find()) {
            profile.setMobile(phoneMatcher.group().trim());
        } else {
            warnings.add("Mobile number not found. Please enter manually.");
        }

        // TODO: Implement Section Heuristics (Experience, Education, Skills)
        // 1. Split text into blocks based on standard CV headers (e.g., "WORK EXPERIENCE", "EDUCATION").
        // 2. Apply Date Regex (e.g., "MM/YYYY - Present") to isolate roles.
        // 3. Cross-reference against a predefined taxonomy of technical skills.

        profile.setWarnings(warnings);
        profile.setParserVersion("v1.0.0-deterministic");

        return profile;
    }

}
\`\`\`

---

## 4. Integration with the RabbitMQ Worker

Finally, the `CvParserWorker` must be updated to orchestrate these services, download the file from S3, execute the parsing, save to PostgreSQL, and dispatch the SSE notification.

\`\`\`java
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class CvParserWorker {

    private final DocumentExtractionService extractionService;
    private final DeterministicParsingService parsingService;
    private final CandidateRepository candidateRepository;
    private final SseNotificationService sseNotificationService;
    private final S3StorageService s3StorageService;

    @RabbitListener(queues = RabbitMQConfig.CANDIDATE_QUEUE, concurrency = "2-5")
    public void processCandidateCv(ParserPayload payload) {
        log.info("Processing CV for candidate ID: {}", payload.getCandidateId());
        try {
            // 1. Fetch file stream
            InputStream fileStream = s3StorageService.downloadFile(payload.getFileKey());

            // 2. Extract raw text based on file extension
            String rawText;
            if (payload.getFileName().toLowerCase().endsWith(".pdf")) {
                rawText = extractionService.extractTextFromPdf(fileStream);
            } else {
                rawText = extractionService.extractTextFromDocx(fileStream);
            }

            // 3. Deterministic Mapping
            ParsedProfileDto extractedData = parsingService.parseRawText(rawText);

            // 4. Update Database
            Candidate candidate = candidateRepository.findById(payload.getCandidateId())
                .orElseThrow(() -> new RuntimeException("Candidate not found"));

            // Update fields only if they are present in the parsed data
            if (extractedData.getEmail() != null) candidate.setEmail(extractedData.getEmail());
            if (extractedData.getMobile() != null) candidate.setMobile(extractedData.getMobile());

            candidateRepository.save(candidate);

            // 5. Dispatch Real-Time Notification via SSE
            String jsonPayload = String.format(
                "{\"status\":\"SUCCESS\", \"candidateId\":\"%s\", \"warnings\":%s}",
                payload.getCandidateId(),
                formatWarningsAsJsonArray(extractedData.getWarnings())
            );
            sseNotificationService.sendEvent(payload.getCandidateId().toString(), "CV_PARSING_COMPLETE", jsonPayload);

        } catch (Exception e) {
            log.error("Parsing failed. Routing to DLQ.", e);
            throw new org.springframework.amqp.AmqpRejectAndDontRequeueException("Deterministic parsing failed", e);
        }
    }

}
\`\`\`

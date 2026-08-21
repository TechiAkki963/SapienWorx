package com.sapienworx.api.cvparser;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Orchestrates object storage, text extraction, deterministic mapping, and a
 * review-only result record. It never writes parsed data directly to a profile.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnBean(CvDocumentStorage.class)
public class StoredDocumentDeterministicCvParsingService implements DeterministicCvParsingService {

    private final CvDocumentStorage documentStorage;
    private final DocumentExtractionService documentExtractionService;
    private final DeterministicProfileMappingService mappingService;
    private final CandidateRepository candidateRepository;
    private final CandidateParseResultRepository parseResultRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Override
    @Transactional
    public CvParsingOutcome parseAndPersist(ParserPayload payload) {
        if (parseResultRepository.existsByRequestId(payload.requestId())) {
            throw new IllegalStateException("A parser result already exists for this request.");
        }

        Candidate candidate = candidateRepository.findById(payload.candidateId())
                .orElseThrow(() -> new IllegalArgumentException("Candidate does not exist for this parser request."));
        Instant startedAt = clock.instant();

        try (InputStream documentStream = documentStorage.open(payload.fileKey())) {
            CvDocumentType documentType = CvDocumentType.from(payload.fileKey(), payload.documentContentType());
            String rawText = documentExtractionService.extractText(documentType, documentStream);
            ParsedCandidateProfile parsedProfile = mappingService.parseRawText(rawText);

            CandidateParseResult parseResult = parseResultRepository.save(CandidateParseResult.builder()
                    .candidate(candidate)
                    .requestId(payload.requestId())
                    .sourceFileKey(payload.fileKey())
                    .status(CandidateParseStatus.REVIEW_REQUIRED)
                    .parserVersion(parsedProfile.parserVersion())
                    .schemaVersion(parsedProfile.schemaVersion())
                    .parsedProfile(objectMapper.valueToTree(parsedProfile))
                    .warnings(objectMapper.valueToTree(parsedProfile.warnings()))
                    .processingDurationMillis(Duration.between(startedAt, clock.instant()).toMillis())
                    .build());

            log.info("Deterministic CV parsing completed for request {}", payload.requestId());
            return new CvParsingOutcome(parseResult.getId(), parsedProfile.parserVersion(), parsedProfile.warnings());
        } catch (IOException exception) {
            throw new DocumentExtractionException("The stored CV document could not be opened.", exception);
        }
    }
}

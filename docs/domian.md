# Master Architecture Prompt: Domain Segregation & Taxonomy Engine

**Objective:** Implement a dictionary-backed taxonomy system in PostgreSQL and a deterministic scoring service in Spring Boot to automatically categorise candidates into "Tech" or "Non-Tech" domains based on their CV data.

---

## 1. Database Layer: Enums & Taxonomy Tables

Rather than creating separate tables for different candidate types, the engineering team must use a unified schema with indexed Enums, supported by a dynamic dictionary table for scoring.

### A. The Domain Enum

Add this Enum to the core application to enforce strict categorisation.

\`\`\`java
public enum DomainCategory {
TECH,
NON_TECH,
MIXED_AMBIGUOUS,
UNASSIGNED
}
\`\`\`

### B. Entity Updates

Update the existing `Candidate` and `Job` JPA entities to include this indexed domain column.

\`\`\`java
// Append to Candidate and Job entities
@Enumerated(EnumType.STRING)
@Column(nullable = false, name = "domain_category")
private DomainCategory domainCategory = DomainCategory.UNASSIGNED;
\`\`\`

### C. The Taxonomy Dictionary Table

This table stores the keywords used by the scoring engine. Storing this in the database (rather than hardcoding it) allows Master Admins to tweak keyword weights dynamically.

| Column Name | Data Type | Constraints      | Description                                               |
| :---------- | :-------- | :--------------- | :-------------------------------------------------------- |
| `id`        | UUID      | Primary Key      | Unique identifier.                                        |
| `keyword`   | VARCHAR   | Unique, Not Null | The lowercase term (e.g., "java", "seo").                 |
| `domain`    | VARCHAR   | Not Null         | Maps to `DomainCategory` (e.g., "TECH").                  |
| `weight`    | INTEGER   | Not Null         | The scoring value (e.g., 10 for "Python", 5 for "Agile"). |

---

## 2. Spring Boot: Deterministic Domain Scoring

The backend team must create a service that analyses the extracted CV text against the `TaxonomyDictionary` to deterministically calculate the candidate's primary domain.

### A. The Scoring Service

This service calculates aggregate scores and assigns the domain based on strict thresholds.

\`\`\`java
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DomainScoringService {

    private final TaxonomyRepository taxonomyRepository;

    public DomainCategory determineCandidateDomain(String extractedCvText) {
        if (extractedCvText == null || extractedCvText.isBlank()) {
            return DomainCategory.UNASSIGNED;
        }

        String normalizedText = extractedCvText.toLowerCase();
        List<TaxonomyKeyword> dictionary = taxonomyRepository.findAll();

        int techScore = 0;
        int nonTechScore = 0;

        // Iterate through the dictionary and apply weights if the keyword exists in the CV
        for (TaxonomyKeyword term : dictionary) {
            if (normalizedText.contains(term.getKeyword())) {
                if (term.getDomain() == DomainCategory.TECH) {
                    techScore += term.getWeight();
                } else if (term.getDomain() == DomainCategory.NON_TECH) {
                    nonTechScore += term.getWeight();
                }
            }
        }

        return evaluateScores(techScore, nonTechScore);
    }

    private DomainCategory evaluateScores(int techScore, int nonTechScore) {
        int totalScore = techScore + nonTechScore;

        // If the CV lacks enough data to make a confident decision
        if (totalScore < 15) {
            return DomainCategory.UNASSIGNED;
        }

        // Calculate percentages
        double techPercentage = (double) techScore / totalScore;
        double nonTechPercentage = (double) nonTechScore / totalScore;

        // Strict thresholds (e.g., must be 70% weighted towards one domain)
        if (techPercentage >= 0.70) {
            return DomainCategory.TECH;
        } else if (nonTechPercentage >= 0.70) {
            return DomainCategory.NON_TECH;
        } else {
            // Flag as ambiguous for the candidate to manually verify during onboarding
            return DomainCategory.MIXED_AMBIGUOUS;
        }
    }

}
\`\`\`

### B. RabbitMQ Worker Integration

The `CvParserWorker` must invoke this scoring service immediately after the raw text is extracted, but before the candidate is saved to the database.

\`\`\`java
// Inside the processCandidateCv method of your CvParserWorker
String rawText = extractionService.extractTextFromPdf(fileStream);

    // Determine Domain
    DomainCategory calculatedDomain = domainScoringService.determineCandidateDomain(rawText);
    candidate.setDomainCategory(calculatedDomain);

    // Proceed with specific data extraction and saving...

\`\`\`

# Master Architecture Prompt: Advanced Candidate Search Interface

**Objective:** Build a comprehensive, highly granular candidate search interface mirroring the structural layout of "screencapture-resdex-naukri-v3-2026-08-24-13_19_15.jpg". The UI must utilise collapsible accordion sections, interactive pill toggles as seen in "Screenshot 2026-08-24 140805.png", and robust form state management to handle the complex JSON payload.

## 1. Global Layout & Accordion Architecture

The form is vertically stacked and incredibly data-heavy. To prevent overwhelming the recruiter, the UI must utilise a strict accordion pattern.

- **The Container:** Restrict the search panel to a left-hand sidebar or a dedicated centre-stage form with a maximum width of `800px` (using `max-w-3xl mx-auto`).
- **Collapsible Sections:** Implement headless UI accordions (e.g., Radix UI or Tailwind UI) for sections like **Employment Details**, **Education Details**, and **Diversity Hiring**.
- **Visual Hierarchy:** Use subtle borders (`border-b border-gray-200`) to separate sections. Accordion headers should be bold (`font-semibold text-gray-900`) with a chevron icon indicating the expand/collapse state.

## 2. Interactive Components (The "Pill" Toggles)

As explicitly shown in "Screenshot 2026-08-24 140805.png", we must move away from standard radio buttons and use tactile "Pill" toggles for categorised selections.

- **Single-Select Pills (e.g., UG Qualification):**
  - _Default State:_ White background, grey border (`bg-white border-gray-300 text-gray-700`).
  - _Active State:_ Light blue background, brand-navy border (`bg-blue-50 border-[#144A75] text-[#144A75]`).
- **Multi-Select Pills (e.g., Education Type):**
  - Recruiters must be able to select multiple options (Full Time + Part Time). Include a small `+` icon for unselected states, swapping to a checkmark `✓` when active.
- **Range Inputs:** Use side-by-side dropdowns for ranges like "Year of degree completion" (From / To) and "Experience" (Min / Max).

## 3. Section Breakdown & Field Specifications

### A. Keyword Sourcing (Top Section)

- **Any / All Keywords:** A large, multi-line text area (or tag-based input) for the primary boolean strings.
- **Exclusion Toggle:** A dedicated "Exclude candidates who mention these keywords" input to refine out false positives.

### B. Employment Details

- **Experience & Salary:** Min/Max dropdowns.
- **Company & Designation:** Autocomplete text inputs. As the recruiter types, the frontend should fetch suggestions from the backend taxonomy.

### C. Education Details (Ref: "Screenshot 2026-08-24 140805.png")

- **UG/PG Qualification:** Implement the three-way pill toggle: `Any UG`, `Specific UG`, `No UG`. If "Specific UG" is clicked, conditionally render a multi-select dropdown for degrees (e.g., B.Tech, B.Sc).
- **Institute Input:** A standard text input for university names.
- **Education Type:** Multi-select pills for `Full Time`, `Part Time`, and `Correspondence`.

## 4. Form State Management (React Hook Form)

Because this search form generates a massive, deeply nested JSON payload, relying on standard React `useState` will cause dreadful performance lags on every keystroke.

- **Implementation:** The team must strictly use `react-hook-form` paired with a schema validation library like `zod`.
- **Debouncing:** Ensure all free-text keyword inputs are debounced by at least `500ms` before triggering any auto-search API calls to the Spring Boot backend to prevent server flooding.
- **Payload Construction:** The form data must be serialised into a clean JSON structure that the Spring Boot `CandidateRepository` can easily parse into PostgreSQL `tsquery` logic.

## \*\*\* POSTGRES

1. The Dynamic Native Query Strategy
   To prevent building a dreadful string concatenation mess in Java, the team must use a native PostgreSQL query within Spring Data JPA, leveraging COALESCE to handle optional filters gracefully.

Keyword Matching: Utilise PostgreSQL's tsvector to handle the "Any", "All", and "Exclude" keyword logic via dynamic tsquery parsing.

Optional Filtering: Use the (:param IS NULL OR column = :param) pattern to ensure the database optimiser ignores empty frontend fields.

Array Intersections: For multi-select fields like "Location" or "Industry", use PostgreSQL array operators (&&) to check for overlaps.

2. Spring Data JPA Repository Implementation
   Your engineers must implement this highly optimised native query inside the CandidateRepository to handle the heavy lifting.

SQL
@Query(value = """
SELECT DISTINCT c.\* FROM candidates c
LEFT JOIN educations e ON c.id = e.candidate_id
LEFT JOIN experiences exp ON c.id = exp.candidate_id
WHERE
-- 1. Full Text Keyword Search (Any, All, Exclude logic pre-formatted in Java)
(:tsQuery IS NULL OR c.search_vector @@ to_tsquery('english', :tsQuery))

        -- 2. Experience & Salary Ranges
        AND (CAST(:minExp AS integer) IS NULL OR c.total_experience >= :minExp)
        AND (CAST(:maxExp AS integer) IS NULL OR c.total_experience <= :maxExp)
        AND (CAST(:minSalary AS integer) IS NULL OR c.current_salary >= :minSalary)

        -- 3. Location (Array overlap check)
        AND (COALESCE(:locations) IS NULL OR c.location = ANY(CAST(:locations AS text[])))

        -- 4. Education Filtering
        AND (:ugQualification IS NULL OR e.ug_degree = :ugQualification)
        AND (:educationType IS NULL OR e.study_type = :educationType)

        -- 5. Diversity & Demographics
        AND (:gender IS NULL OR c.gender = :gender)

        ORDER BY ts_rank(c.search_vector, to_tsquery('english', :tsQuery)) DESC
        """,
        countQuery = "...", -- (Matching count query omitted for brevity)
        nativeQuery = true)
    Page<Candidate> executeGranularSearch(
        @Param("tsQuery") String tsQuery,
        @Param("minExp") Integer minExp,
        @Param("maxExp") Integer maxExp,
        @Param("minSalary") Integer minSalary,
        @Param("locations") String[] locations,
        @Param("ugQualification") String ugQualification,
        @Param("educationType") String educationType,
        @Param("gender") String gender,
        Pageable pageable
    );

3. Mandatory Database Indices
   To ensure this query executes in milliseconds rather than seconds, your database administrator must apply specific indices.

Create a GIN index on the search_vector column to instantly process text matches.

Create a B-Tree composite index on (total_experience, current_salary) for rapid range scanning.

Create distinct B-Tree indices on foreign keys (candidate_id) within the educations and experiences tables to speed up the left joins.

## Java Spring

# Master Architecture Prompt: TsQuery Builder Service

**Objective:** Implement a Spring Boot service dedicated to transforming the frontend's keyword arrays (Any, All, Exclude) into a valid PostgreSQL `tsquery` string. This service must correctly apply boolean logic and handle multi-word phrases to power the Advanced Sourcing Engine.

## 1. The PostgreSQL tsquery Syntax Rules

The service must strictly adhere to the following PostgreSQL text search operators:

- `&` (AND) — Used for "All keywords" and to join the different condition groups.
- `|` (OR) — Used for "Any keywords".
- `!` (NOT) — Used for "Exclude keywords".
- Phrases containing spaces (e.g., "Product Manager") must have their spaces replaced by the `<->` (FOLLOWED BY) operator to ensure exact phrase matching, rather than falling back to an implicit AND.

## 2. The TsQuery Builder Implementation

Create the following utility service within your core search module.

\`\`\`java
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TsQueryBuilderService {

    /**
     * Constructs a valid PostgreSQL tsquery string from the frontend keyword arrays.
     * Example Output: (java & spring) | (react) & !(angular | php)
     */
    public String build(List<String> anyKeywords, List<String> allKeywords, List<String> excludeKeywords) {
        StringBuilder queryBuilder = new StringBuilder();

        // 1. Process 'All' Keywords (AND Logic)
        if (allKeywords != null && !allKeywords.isEmpty()) {
            String all = allKeywords.stream()
                    .map(this::formatToken)
                    .collect(Collectors.joining(" & "));
            queryBuilder.append("(").append(all).append(")");
        }

        // 2. Process 'Any' Keywords (OR Logic)
        if (anyKeywords != null && !anyKeywords.isEmpty()) {
            String any = anyKeywords.stream()
                    .map(this::formatToken)
                    .collect(Collectors.joining(" | "));

            if (!queryBuilder.isEmpty()) {
                queryBuilder.append(" & "); // Join groups with AND
            }
            queryBuilder.append("(").append(any).append(")");
        }

        // 3. Process 'Exclude' Keywords (NOT Logic)
        if (excludeKeywords != null && !excludeKeywords.isEmpty()) {
            String exclude = excludeKeywords.stream()
                    .map(this::formatToken)
                    .collect(Collectors.joining(" | "));

            if (!queryBuilder.isEmpty()) {
                queryBuilder.append(" & ");
            }
            queryBuilder.append("!(").append(exclude).append(")");
        }

        // Return null if all fields were empty so the DB query can ignore it via COALESCE
        return queryBuilder.isEmpty() ? null : queryBuilder.toString();
    }

    /**
     * Formats individual keywords. Converts spaces into the tsquery phrase operator `<->`.
     * E.g., "software engineer" -> "software<->engineer"
     */
    private String formatToken(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return "";
        }
        String trimmed = keyword.trim();
        if (trimmed.contains(" ")) {
            return trimmed.replaceAll("\\s+", "<->");
        }
        return trimmed;
    }

}
\`\`\`

## 3. Integration with the Controller

When the frontend submits the search payload, the controller or facade layer must invoke this builder before passing the resulting string to the `CandidateRepository`.

\`\`\`java
// Inside your CandidateSearchService
public Page<CandidateDto> search(SearchPayloadDto payload, Pageable pageable) {
String tsQuery = tsQueryBuilderService.build(
payload.getAnyKeywords(),
payload.getAllKeywords(),
payload.getExcludeKeywords()
);

    // Pass the formatted string down to the native @Query we built earlier
    return candidateRepository.executeGranularSearch(
        tsQuery,
        payload.getMinExperience(),
        // ... other parameters
        pageable
    ).map(candidateMapper::toDto);

}
\`\`\`

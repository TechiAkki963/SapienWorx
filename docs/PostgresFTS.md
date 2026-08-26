import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface CandidateRepository extends JpaRepository<Candidate, UUID> {

    /**
     * Executes a native PostgreSQL full-text search using tsvector and tsquery.
     * The booleanQuery parameter must be pre-formatted in the service layer
     * (e.g., 'Figma & "design systems" & !agency').
     */
    @Query(value = """
        SELECT c.* FROM candidates c
        WHERE c.experience_years >= :minExperience
        AND (:education = 'All' OR c.education_level = :education)
        AND c.search_vector @@ to_tsquery('english', :booleanQuery)
        ORDER BY ts_rank(c.search_vector, to_tsquery('english', :booleanQuery)) DESC
        """,
        countQuery = """
        SELECT count(*) FROM candidates c
        WHERE c.experience_years >= :minExperience
        AND (:education = 'All' OR c.education_level = :education)
        AND c.search_vector @@ to_tsquery('english', :booleanQuery)
        """,
        nativeQuery = true)
    Page<Candidate> searchCandidates(
        @Param("booleanQuery") String booleanQuery,
        @Param("minExperience") Integer minExperience,
        @Param("education") String education,
        Pageable pageable
    );

}

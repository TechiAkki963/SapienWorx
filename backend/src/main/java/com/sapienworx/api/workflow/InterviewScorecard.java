package com.sapienworx.api.workflow;

import com.sapienworx.api.interview.Interview;
import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "interview_scorecards")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class InterviewScorecard {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "interview_id") private Interview interview;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "recruiter_id") private Recruiter recruiter;
    @Column(nullable = false, length = 24) private String recommendation;
    @Column(nullable = false) private int score;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "criteria_scores", nullable = false, columnDefinition = "jsonb")
    @Builder.Default private Map<String, Integer> criteriaScores = Map.of();
    @Column(nullable = false, length = 4000) private String feedback;
    @org.hibernate.annotations.UpdateTimestamp @Column(name = "submitted_at", nullable = false) private Instant submittedAt;
}

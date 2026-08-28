package com.sapienworx.api.workflow;

import com.sapienworx.api.interview.Interview;
import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "interview_scorecards")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class InterviewScorecard {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "interview_id") private Interview interview;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "recruiter_id") private Recruiter recruiter;
    @Column(nullable = false, length = 24) private String recommendation;
    @Column(nullable = false) private int score;
    @Column(nullable = false, length = 4000) private String feedback;
    @CreationTimestamp @Column(name = "submitted_at", nullable = false, updatable = false) private Instant submittedAt;
}

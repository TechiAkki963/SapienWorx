package com.sapienworx.api.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "recruiter_saved_searches")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RecruiterSavedSearch {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "recruiter_id") private Recruiter recruiter;
    @Column(name = "search_name", nullable = false, length = 160) private String searchName;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") private JsonNode criteria;
    @Enumerated(EnumType.STRING) @Column(name = "alert_frequency", nullable = false, length = 16) @Builder.Default private SavedSearchAlertFrequency alertFrequency = SavedSearchAlertFrequency.OFF;
    @Column(name = "last_alerted_at") private Instant lastAlertedAt;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}

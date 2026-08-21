package com.sapienworx.api.application;

import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "recruiter_notes")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecruiterNote {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "application_id", nullable = false) private JobApplication application;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "recruiter_id", nullable = false) private Recruiter recruiter;
    @Column(name = "note_text", nullable = false, columnDefinition = "text") private String noteText;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}

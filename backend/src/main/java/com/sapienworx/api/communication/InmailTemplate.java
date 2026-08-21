package com.sapienworx.api.communication;

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
import jakarta.persistence.UniqueConstraint;
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
@Table(name = "inmail_templates", uniqueConstraints = @UniqueConstraint(name = "uk_inmail_templates_recruiter_name", columnNames = {"recruiter_id", "template_name"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class InmailTemplate {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "recruiter_id", nullable = false) private Recruiter recruiter;
    @Column(name = "template_name", nullable = false, length = 160) private String templateName;
    @Column(nullable = false, length = 250) private String subject;
    @Column(name = "body_html", nullable = false, columnDefinition = "text") private String bodyHtml;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}

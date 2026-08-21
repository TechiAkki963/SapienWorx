package com.sapienworx.api.communication;

import com.sapienworx.api.application.JobApplication;
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

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "direct_messages")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DirectMessage {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "sender_id", nullable = false) private UUID senderId;
    @Column(name = "recipient_id", nullable = false) private UUID recipientId;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "job_application_id") private JobApplication jobApplication;
    @Column(nullable = false, columnDefinition = "text") private String body;
    @CreationTimestamp @Column(name = "sent_at", nullable = false, updatable = false) private Instant sentAt;
    @Column(name = "read_at") private Instant readAt;
}

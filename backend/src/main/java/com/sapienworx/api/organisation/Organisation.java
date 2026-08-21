package com.sapienworx.api.organisation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * Tenant data required by the Job entity. jobSequence is incremented only while
 * the organisation row is pessimistically locked by JobPublicIdAllocator.
 */
@Entity
@Table(name = "organisations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Organisation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(nullable = false, length = 12)
    private String initials;

    @Builder.Default
    @Column(name = "job_sequence", nullable = false)
    private long jobSequence = 0L;

    public long claimNextJobSequence() {
        jobSequence += 1;
        return jobSequence;
    }
}

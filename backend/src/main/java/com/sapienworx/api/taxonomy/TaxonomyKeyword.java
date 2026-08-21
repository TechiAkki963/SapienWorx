package com.sapienworx.api.taxonomy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Locale;
import java.util.UUID;

/** Master-admin managed scoring term; no candidate content is stored here. */
@Entity
@Table(name = "taxonomy_keywords")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaxonomyKeyword {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 120)
    private String keyword;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DomainCategory domain;

    @Column(nullable = false)
    private Integer weight;

    @PrePersist
    @PreUpdate
    void normaliseAndValidate() {
        keyword = keyword == null ? null : keyword.trim().toLowerCase(Locale.ROOT);
        if (keyword == null || keyword.isBlank()) {
            throw new IllegalArgumentException("Taxonomy keywords cannot be blank.");
        }
        if (domain != DomainCategory.TECH && domain != DomainCategory.NON_TECH) {
            throw new IllegalArgumentException("Taxonomy keywords must map to TECH or NON_TECH.");
        }
        if (weight == null || weight <= 0) {
            throw new IllegalArgumentException("Taxonomy keyword weight must be positive.");
        }
    }
}

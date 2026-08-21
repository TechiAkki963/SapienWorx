package com.sapienworx.api.taxonomy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface TaxonomyRepository extends JpaRepository<TaxonomyKeyword, UUID> {
    List<TaxonomyKeyword> findAllByDomainIn(Collection<DomainCategory> domains);
}

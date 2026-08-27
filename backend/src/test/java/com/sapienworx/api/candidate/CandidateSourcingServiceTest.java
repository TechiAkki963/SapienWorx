package com.sapienworx.api.candidate;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CandidateSourcingServiceTest {

    @Test
    void forwardsEmploymentClassificationFiltersToTheCandidateQuery() {
        CandidateRepository candidateRepository = mock(CandidateRepository.class);
        CandidateSourcingService service = new CandidateSourcingService(candidateRepository, Clock.systemUTC(), new TsQueryBuilderService());

        service.search(new CandidateSourcingCriteria(
                List.of("TypeScript"), List.of(), List.of(), "", 5, 8, 20, 25, "Bengaluru", "StatusNeo", "Senior Consultant", "Engineering / Platform", "Software product",
                "", "", "", List.of(), "", null, ActiveStatusInterval.SEVEN_DAYS, 0, 40, null, false, false, false
        ));

        verify(candidateRepository).searchVisibleCandidates(
                anyString(), any(), any(), any(), any(), anyString(), eq("StatusNeo"), eq("Senior Consultant"), eq("Engineering / Platform"), eq("Software product"), anyString(), anyString(), anyString(), any(), anyString(), any(), any(),
                anyString(), anyBoolean(), anyBoolean(), anyBoolean(), any(Pageable.class)
        );
    }

    @Test
    void locksSourcingPagesToTenAndCalculatesTheConfiguredActivityWindow() {
        CandidateRepository candidateRepository = mock(CandidateRepository.class);
        Clock clock = Clock.fixed(Instant.parse("2026-08-21T10:00:00Z"), ZoneOffset.UTC);
        CandidateSourcingService service = new CandidateSourcingService(candidateRepository, clock, new TsQueryBuilderService());

        when(candidateRepository.searchVisibleCandidates(
                anyString(), any(), any(), any(), any(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), anyString(), any(), any(),
                anyString(), anyBoolean(), anyBoolean(), anyBoolean(), any(Pageable.class)
        )).thenReturn(Page.empty());

        service.search(new CandidateSourcingCriteria(
                "React AND \"Node.js\"", "React", "PHP", 3, 8, 12, 30, "Bengaluru",
                "Indian Institute", "", "Computer Science", 30, ActiveStatusInterval.SEVEN_DAYS, 4
        ));

        ArgumentCaptor<Instant> activeSince = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(candidateRepository).searchVisibleCandidates(
                anyString(), any(), any(), any(), any(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), anyString(), any(),
                activeSince.capture(), anyString(), anyBoolean(), anyBoolean(), anyBoolean(), pageable.capture()
        );

        assertThat(activeSince.getValue()).isEqualTo(Instant.parse("2026-08-14T10:00:00Z"));
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(4);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(CandidateSourcingService.PAGE_SIZE);
    }
}

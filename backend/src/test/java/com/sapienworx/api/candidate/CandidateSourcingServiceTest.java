package com.sapienworx.api.candidate;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CandidateSourcingServiceTest {

    @Test
    void locksSourcingPagesToTenAndCalculatesTheConfiguredActivityWindow() {
        CandidateRepository candidateRepository = mock(CandidateRepository.class);
        Clock clock = Clock.fixed(Instant.parse("2026-08-21T10:00:00Z"), ZoneOffset.UTC);
        CandidateSourcingService service = new CandidateSourcingService(candidateRepository, clock);

        when(candidateRepository.searchVisibleCandidates(
                anyString(), anyString(), anyString(), any(), any(), any(), any(), anyString(), anyString(), anyString(),
                anyString(), any(), any(), anyString(), anyBoolean(), anyBoolean(), anyBoolean(), any(Pageable.class)
        )).thenReturn(Page.empty());

        service.search(new CandidateSourcingCriteria(
                "React AND \"Node.js\"", "React", "PHP", 3, 8, 12, 30, "Bengaluru",
                "Indian Institute", "", "Computer Science", 30, ActiveStatusInterval.SEVEN_DAYS, 4
        ));

        ArgumentCaptor<Instant> activeSince = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(candidateRepository).searchVisibleCandidates(
                anyString(), anyString(), anyString(), any(), any(), any(), any(), anyString(), anyString(), anyString(),
                anyString(), any(), activeSince.capture(), anyString(), anyBoolean(), anyBoolean(), anyBoolean(), pageable.capture()
        );

        assertThat(activeSince.getValue()).isEqualTo(Instant.parse("2026-08-14T10:00:00Z"));
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(4);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(CandidateSourcingService.PAGE_SIZE);
    }
}

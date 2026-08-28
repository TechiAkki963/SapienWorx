package com.sapienworx.api.admin;

import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.PlatformRole;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PlatformAccessPolicyTest {

    @Test
    void blocksSuspendedCandidateSessions() {
        PlatformControlsRepository controls = mock(PlatformControlsRepository.class);
        PlatformSubjectControlRepository subjects = mock(PlatformSubjectControlRepository.class);
        CandidateRepository candidates = mock(CandidateRepository.class);
        UUID candidateId = UUID.randomUUID();
        when(controls.findById(true)).thenReturn(Optional.of(new PlatformControls()));
        when(candidates.existsById(candidateId)).thenReturn(true);
        when(subjects.findBySubjectTypeAndSubjectId(PlatformSubjectType.CANDIDATE, candidateId)).thenReturn(Optional.of(
                PlatformSubjectControl.builder().subjectType(PlatformSubjectType.CANDIDATE).subjectId(candidateId).suspended(true).reason("Policy review").build()));

        PlatformAccessPolicy policy = new PlatformAccessPolicy(controls, subjects, mock(RecruiterRepository.class), candidates, mock(JobRepository.class));

        PlatformAccessPolicy.AccessDecision decision = policy.accessFor(new AuthenticatedUser(candidateId, PlatformRole.CANDIDATE));

        assertThat(decision.permitted()).isFalse();
        assertThat(decision.status()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void makesMaintenanceModeAnEnforcedPublicGate() {
        PlatformControlsRepository controls = mock(PlatformControlsRepository.class);
        PlatformControls configuration = new PlatformControls();
        configuration.setMaintenanceMode(true);
        when(controls.findById(true)).thenReturn(Optional.of(configuration));
        PlatformAccessPolicy policy = new PlatformAccessPolicy(controls, mock(PlatformSubjectControlRepository.class), mock(RecruiterRepository.class), mock(CandidateRepository.class), mock(JobRepository.class));

        assertThatThrownBy(policy::requirePublicPlatformAvailable)
                .isInstanceOf(ResponseStatusException.class)
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(policy.accessFor(new AuthenticatedUser(UUID.randomUUID(), PlatformRole.SUPER_ADMIN)).permitted()).isTrue();
    }

    @Test
    void makesCvParserSwitchAnEnforcedGate() {
        PlatformControlsRepository controls = mock(PlatformControlsRepository.class);
        PlatformControls configuration = new PlatformControls();
        configuration.setCvParsingEnabled(false);
        when(controls.findById(true)).thenReturn(Optional.of(configuration));
        PlatformAccessPolicy policy = new PlatformAccessPolicy(controls, mock(PlatformSubjectControlRepository.class), mock(RecruiterRepository.class), mock(CandidateRepository.class), mock(JobRepository.class));

        assertThatThrownBy(policy::requireCvParsingEnabled)
                .isInstanceOf(ResponseStatusException.class)
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }
}

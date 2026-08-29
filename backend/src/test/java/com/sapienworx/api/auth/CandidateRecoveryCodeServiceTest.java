package com.sapienworx.api.auth;

import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CandidateRecoveryCodeServiceTest {

    @Test
    void generatesEightHashedCodesAndConsumesEachOnlyOnce() {
        CandidateRecoveryCodeRepository repository = mock(CandidateRecoveryCodeRepository.class);
        CandidateRepository candidates = mock(CandidateRepository.class);
        UUID candidateId = UUID.randomUUID();
        Candidate candidate = Candidate.builder().id(candidateId).fullName("A Candidate").build();
        List<CandidateRecoveryCode> stored = new ArrayList<>();
        when(candidates.findById(candidateId)).thenReturn(Optional.of(candidate));
        when(repository.save(any(CandidateRecoveryCode.class))).thenAnswer(call -> {
            CandidateRecoveryCode value = call.getArgument(0);
            stored.add(value);
            return value;
        });
        when(repository.findByCandidate_IdAndUsedAtIsNull(candidateId)).thenAnswer(call -> stored.stream().filter(code -> code.getUsedAt() == null).toList());
        CandidateRecoveryCodeService service = new CandidateRecoveryCodeService(repository, candidates, new BCryptPasswordEncoder());

        List<String> plainText = service.generate(candidateId);

        assertThat(plainText).hasSize(8).allMatch(code -> code.matches("SWX-[A-Z2-9]{4}-[A-Z2-9]{4}"));
        assertThat(stored).hasSize(8).allMatch(code -> !plainText.contains(code.getCodeHash()));
        assertThat(service.consume(candidateId, plainText.get(0).toLowerCase())).isTrue();
        assertThat(service.consume(candidateId, plainText.get(0))).isFalse();
        assertThat(service.remaining(candidateId)).isEqualTo(7);
    }
}

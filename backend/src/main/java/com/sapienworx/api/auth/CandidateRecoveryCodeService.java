package com.sapienworx.api.auth;

import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CandidateRecoveryCodeService {
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CandidateRecoveryCodeRepository codes;
    private final CandidateRepository candidates;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public List<String> generate(UUID candidateId) {
        Candidate candidate = candidates.findById(candidateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate account was not found."));
        codes.deleteByCandidate_Id(candidateId);
        List<String> plainTextCodes = new ArrayList<>();
        for (int index = 0; index < 8; index++) {
            String code = "SWX-" + segment() + "-" + segment();
            plainTextCodes.add(code);
            codes.save(CandidateRecoveryCode.builder().candidate(candidate).codeHash(passwordEncoder.encode(normalize(code)))
                    .createdAt(Instant.now()).build());
        }
        return List.copyOf(plainTextCodes);
    }

    @Transactional
    public boolean consume(UUID candidateId, String submitted) {
        if (submitted == null || submitted.isBlank()) return false;
        for (CandidateRecoveryCode code : codes.findByCandidate_IdAndUsedAtIsNull(candidateId)) {
            if (passwordEncoder.matches(normalize(submitted), code.getCodeHash())) {
                code.setUsedAt(Instant.now());
                return true;
            }
        }
        return false;
    }

    @Transactional(readOnly = true)
    public int remaining(UUID candidateId) {
        return codes.findByCandidate_IdAndUsedAtIsNull(candidateId).size();
    }

    private String segment() {
        StringBuilder value = new StringBuilder(4);
        for (int index = 0; index < 4; index++) value.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return value.toString();
    }

    private String normalize(String value) {
        return value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(java.util.Locale.ROOT);
    }
}

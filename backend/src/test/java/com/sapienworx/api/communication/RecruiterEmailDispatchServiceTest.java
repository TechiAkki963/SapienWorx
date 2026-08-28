package com.sapienworx.api.communication;

import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class RecruiterEmailDispatchServiceTest {

    @Test
    void queuesOnlyTheVerifiedCandidateEmailWithNoApiExposure() {
        CandidateRepository candidateRepository = mock(CandidateRepository.class);
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        RecruiterEmailDispatchService service = new RecruiterEmailDispatchService(candidateRepository, rabbitTemplate, mock(PlatformAccessPolicy.class));
        UUID candidateId = UUID.randomUUID();
        Candidate candidate = Candidate.builder()
                .id(candidateId)
                .email("candidate@example.com")
                .emailVerified(true)
                .build();
        when(candidateRepository.findById(candidateId)).thenReturn(Optional.of(candidate));

        UUID dispatchId = service.queueForCandidate(candidateId,
                new RecruiterEmailCommand(candidateId, "SWX_NT_001", "Interview update", "<p>Hello</p>"));

        ArgumentCaptor<EmailDispatchPayload> payload = ArgumentCaptor.forClass(EmailDispatchPayload.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMqCommunicationConfig.EMAIL_EXCHANGE),
                eq(RabbitMqCommunicationConfig.EMAIL_ROUTING_KEY),
                payload.capture()
        );
        assertThat(payload.getValue().dispatchId()).isEqualTo(dispatchId);
        assertThat(payload.getValue().candidateId()).isEqualTo(candidateId);
        assertThat(payload.getValue().recipientEmail()).isEqualTo("candidate@example.com");
    }

    @Test
    void refusesToQueueAnUnverifiedCandidateEmail() {
        CandidateRepository candidateRepository = mock(CandidateRepository.class);
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        RecruiterEmailDispatchService service = new RecruiterEmailDispatchService(candidateRepository, rabbitTemplate, mock(PlatformAccessPolicy.class));
        UUID candidateId = UUID.randomUUID();
        Candidate candidate = Candidate.builder().id(candidateId).email("candidate@example.com").build();
        when(candidateRepository.findById(candidateId)).thenReturn(Optional.of(candidate));

        assertThatThrownBy(() -> service.queueForCandidate(candidateId,
                new RecruiterEmailCommand(candidateId, null, "Subject", "<p>Hello</p>")))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(rabbitTemplate);
    }
}

package com.sapienworx.api.audit;

import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.PlatformRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class AuditLoggingAspectTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void recordsTheAuthenticatedActorAndExplicitCandidateArgumentAfterSuccess() {
        AuditLogWriter auditLogWriter = mock(AuditLogWriter.class);
        AuditedOperation operation = proxiedOperation(auditLogWriter);
        UUID recruiterId = UUID.randomUUID();
        UUID candidateId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(recruiterId, PlatformRole.RECRUITER), null
        ));

        operation.complete(candidateId, "SWX_NT_003");

        var command = forClass(AuditLogCommand.class);
        verify(auditLogWriter).record(command.capture());
        assertThat(command.getValue().actorId()).isEqualTo(recruiterId);
        assertThat(command.getValue().candidateId()).isEqualTo(candidateId);
        assertThat(command.getValue().resourceId()).isEqualTo(candidateId);
        assertThat(command.getValue().jobId()).isEqualTo("SWX_NT_003");
        assertThat(command.getValue().action()).isEqualTo("CONTACT_DETAILS_UNMASKED");
    }

    @Test
    void doesNotRecordAnActionThatThrows() {
        AuditLogWriter auditLogWriter = mock(AuditLogWriter.class);
        AuditedOperation operation = proxiedOperation(auditLogWriter);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(UUID.randomUUID(), PlatformRole.RECRUITER), null
        ));

        try {
            operation.failingOperation(UUID.randomUUID());
        } catch (IllegalStateException ignored) {
            // The test verifies after-returning advice does not run for this failed action.
        }

        verify(auditLogWriter, never()).record(org.mockito.ArgumentMatchers.any());
    }

    private AuditedOperation proxiedOperation(AuditLogWriter auditLogWriter) {
        AspectJProxyFactory factory = new AspectJProxyFactory(new AuditedOperation());
        factory.addAspect(new AuditLoggingAspect(auditLogWriter));
        return factory.getProxy();
    }

    static class AuditedOperation {

        @AuditAction(
                action = "CONTACT_DETAILS_UNMASKED",
                resourceType = "CANDIDATE",
                resourceIdArgumentIndex = 0,
                candidateIdArgumentIndex = 0,
                jobIdArgumentIndex = 1
        )
        public void complete(UUID candidateId, String jobId) {
        }

        @AuditAction(action = "CONTACT_DETAILS_UNMASKED", resourceType = "CANDIDATE")
        public void failingOperation(UUID candidateId) {
            throw new IllegalStateException("Expected test failure");
        }
    }
}

package com.sapienworx.api.audit;

import com.sapienworx.api.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Records successful annotated actions without risking PII in the application log. */
@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class AuditLoggingAspect {

    private final AuditLogWriter auditLogWriter;

    @AfterReturning("@annotation(auditAction)")
    public void logSuccessfulAction(JoinPoint joinPoint, AuditAction auditAction) {
        try {
            AuthenticatedUser actor = authenticatedUser();
            if (actor == null) {
                log.warn("Sensitive action {} completed without an authenticated platform principal", auditAction.action());
                return;
            }

            Object[] arguments = joinPoint.getArgs();
            auditLogWriter.record(new AuditLogCommand(
                    actor.userId(),
                    auditAction.action(),
                    auditAction.resourceType(),
                    uuidArgument(arguments, auditAction.resourceIdArgumentIndex()),
                    uuidArgument(arguments, auditAction.candidateIdArgumentIndex()),
                    null,
                    stringArgument(arguments, auditAction.jobIdArgumentIndex())
            ));
        } catch (RuntimeException exception) {
            // Compliance capture must never turn a successful candidate/recruiter action into an API failure.
            log.error("DPDP audit persistence failed for action {}", auditAction.action(), exception);
        }
    }

    private AuthenticatedUser authenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser authenticatedUser)) {
            return null;
        }
        return authenticatedUser;
    }

    private UUID uuidArgument(Object[] arguments, int argumentIndex) {
        if (argumentIndex < 0 || arguments == null || argumentIndex >= arguments.length || arguments[argumentIndex] == null) {
            return null;
        }
        Object argument = arguments[argumentIndex];
        if (argument instanceof UUID uuid) {
            return uuid;
        }
        if (argument instanceof String value) {
            try {
                return UUID.fromString(value);
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }
        return null;
    }

    private String stringArgument(Object[] arguments, int argumentIndex) {
        if (argumentIndex < 0 || arguments == null || argumentIndex >= arguments.length || !(arguments[argumentIndex] instanceof String value)) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}

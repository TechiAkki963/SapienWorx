# Master Architecture Prompt: Communications & DPDP Compliance

**Objective:** Implement a resilient, RabbitMQ-backed bulk email dispatcher using Spring Mail, and establish a centralised, immutable DPDP Audit Logging service utilising Spring AOP (Aspect-Oriented Programming) to automatically track sensitive recruiter actions.

---

## 1. Bulk Email Dispatcher (RabbitMQ + Spring Mail)

To prevent blocking the main API threads when a recruiter sends hundreds of templated messages, the dispatch process must be offloaded to a dedicated RabbitMQ queue.

### A. Queue Configuration

Append this to the existing `RabbitMQConfig` class.

\`\`\`java
public static final String EMAIL_QUEUE = "email.bulk.queue";

    @Bean
    public Queue emailQueue() {
        return QueueBuilder.durable(EMAIL_QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", DEAD_LETTER_QUEUE)
                .build();
    }

    @Bean
    public Binding emailBinding(Queue emailQueue, DirectExchange parserExchange) {
        return BindingBuilder.bind(emailQueue).to(parserExchange).with("dispatch.email");
    }

\`\`\`

### B. The Asynchronous Email Worker

This listener consumes the email payloads and dispatches them via Spring's `JavaMailSender`.

\`\`\`java
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailDispatcherWorker {

    private final JavaMailSender mailSender;

    @RabbitListener(queues = RabbitMQConfig.EMAIL_QUEUE, concurrency = "3-10")
    public void processEmailDispatch(EmailPayload payload) {
        log.info("Dispatching email to: {} for Job ID: {}", payload.getRecipientEmail(), payload.getJobId());
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(payload.getRecipientEmail());
            helper.setSubject(payload.getSubject());
            helper.setText(payload.getHtmlContent(), true); // Set to true for HTML
            helper.setFrom("notifications@sapienworx.com"); // Must be a verified domain

            mailSender.send(message);
        } catch (Exception e) {
            log.error("Failed to send email to: {}", payload.getRecipientEmail(), e);
            throw new org.springframework.amqp.AmqpRejectAndDontRequeueException("Email dispatch failed", e);
        }
    }

}
\`\`\`

---

## 2. DPDP Audit Logging Service (Spring AOP)

To maintain strict data compliance, the system must record immutable logs of sensitive actions. We will use a custom annotation and an Aspect to intercept these actions seamlessly.

### A. The Custom Annotation

Engineers will use this annotation on any controller or service method that handles sensitive data (e.g., unmasking contact details, changing pipeline stages).

\`\`\`java
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditAction {
String action(); // e.g., "CONTACT_UNMASKED", "STAGE_CHANGED"
}
\`\`\`

### B. The AOP Aspect

This Aspect intercepts methods annotated with `@AuditAction`, extracts the current user's ID from the Spring Security context, and writes the log to the database.

\`\`\`java
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditLoggingAspect {

    private final AuditLogRepository auditLogRepository;

    @AfterReturning("@annotation(auditAction)")
    public void logAction(JoinPoint joinPoint, AuditAction auditAction) {
        try {
            // Extract the authenticated recruiter's ID
            String actorId = SecurityContextHolder.getContext().getAuthentication().getName();

            // Extract the target ID (assumes the first argument is the target entity UUID/String)
            String targetEntityId = "UNKNOWN";
            Object[] args = joinPoint.getArgs();
            if (args != null && args.length > 0) {
                targetEntityId = args[0].toString();
            }

            // Build and save the immutable log
            AuditLog logEntry = AuditLog.builder()
                .actionPerformed(auditAction.action())
                .actorId(actorId)
                .targetEntityId(targetEntityId)
                .build();

            auditLogRepository.save(logEntry);
            log.debug("Audit log recorded: {} by user {}", auditAction.action(), actorId);

        } catch (Exception e) {
            // Logging must not break the main business transaction, but failures must be severely alerted
            log.error("CRITICAL: Failed to write audit log for action: {}", auditAction.action(), e);
        }
    }

}
\`\`\`

### C. Implementation Example

Here is how an engineer would apply the annotation to a service method:

\`\`\`java
@Service
public class PipelineService {

    // The Aspect automatically intercepts this successful execution
    @AuditAction(action = "PIPELINE_STAGE_CHANGED")
    public void moveCandidateStage(UUID candidateId, String newStage) {
        // Business logic to update candidate stage...
    }

    @AuditAction(action = "CONTACT_DETAILS_UNMASKED")
    public ContactDto revealCandidateContact(UUID candidateId) {
        // Business logic to unmask and return details...
    }

}
\`\`\`

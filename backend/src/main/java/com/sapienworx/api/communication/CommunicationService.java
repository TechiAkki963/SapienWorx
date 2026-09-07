package com.sapienworx.api.communication;

import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.events.SseNotificationService;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.security.PlatformRole;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CommunicationService {
    private final DirectMessageRepository messageRepository;
    private final JobApplicationRepository applicationRepository;
    private final RecruiterRepository recruiterRepository;
    private final CandidateRepository candidateRepository;
    private final InmailTemplateRepository templateRepository;
    private final SseNotificationService sseNotificationService;
    private final NotificationService notificationService;
    private final TransactionalEmailDispatchService transactionalEmailDispatchService;

    @Transactional
    @AuditAction(action = "INTERNAL_MESSAGE_SENT", resourceType = "MESSAGE", resourceIdArgumentIndex = -1, candidateIdArgumentIndex = -1)
    public MessageResponse send(UUID senderId, PlatformRole senderRole, MessageRequest request) {
        JobApplication application = request.applicationId() == null ? null : applicationRepository.findById(request.applicationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application was not found."));
        requireConversationAccess(senderId, senderRole, request.recipientId(), application);
        DirectMessage message = messageRepository.save(DirectMessage.builder().senderId(senderId).recipientId(request.recipientId()).jobApplication(application).body(request.body().trim()).build());
        String jobTitle = application == null ? "your Sapienworx application" : application.getJob().getTitle();
        notificationService.create(request.recipientId(), "MESSAGE_RECEIVED", "New message",
                "A new application-linked message is ready for you.", "APPLICATION", application == null ? null : application.getId());
        queueSecureMessageEmail(senderId, senderRole, request.recipientId(), application, jobTitle);
        sseNotificationService.sendToUser(request.recipientId(), "MESSAGE_RECEIVED", MessageResponse.from(message));
        return MessageResponse.from(message);
    }

    @Transactional
    public Page<MessageResponse> conversation(UUID userId, UUID counterpartId, Pageable pageable) {
        Page<DirectMessage> messages = messageRepository.conversation(userId, counterpartId, pageable);
        messages.stream().filter(message -> message.getRecipientId().equals(userId) && message.getReadAt() == null).forEach(message -> message.setReadAt(Instant.now()));
        return messages.map(MessageResponse::from);
    }

    /**
     * A candidate can only see a recruiter in the inbox when they share an application.
     * Grouping by recruiter avoids duplicate threads when a candidate has applied to several roles.
     */
    @Transactional(readOnly = true)
    public List<CandidateConversationResponse> candidateConversations(UUID candidateId) {
        Map<UUID, JobApplication> applicationByRecruiter = new HashMap<>();
        for (JobApplication application : applicationRepository.findByCandidate_Id(candidateId, Pageable.unpaged())) {
            Recruiter recruiter = application.getRecipientRecruiter();
            if (recruiter == null) continue;
            JobApplication existing = applicationByRecruiter.get(recruiter.getId());
            if (existing == null || application.getUpdatedAt().isAfter(existing.getUpdatedAt())) {
                applicationByRecruiter.put(recruiter.getId(), application);
            }
        }

        List<CandidateConversationResponse> conversations = new ArrayList<>();
        for (JobApplication application : applicationByRecruiter.values()) {
            Recruiter recruiter = application.getRecipientRecruiter();
            DirectMessage latest = messageRepository.recentConversation(candidateId, recruiter.getId(), org.springframework.data.domain.PageRequest.of(0, 1))
                    .stream().findFirst().orElse(null);
            Instant activityAt = latest == null ? application.getUpdatedAt() : latest.getSentAt();
            conversations.add(new CandidateConversationResponse(
                    recruiter.getId(), recruiter.getFullName(), recruiter.getDesignation(), recruiter.getOrganisation().getName(),
                    application.getId(), application.getJob().getTitle(), application.getPipelineStage(),
                    latest == null ? null : latest.getBody(), latest == null ? null : latest.getSentAt(), activityAt,
                    messageRepository.countBySenderIdAndRecipientIdAndReadAtIsNull(recruiter.getId(), candidateId)
            ));
        }
        conversations.sort(Comparator.comparing(CandidateConversationResponse::activityAt).reversed());
        return conversations;
    }

    /** Recruiters see only candidates for applications addressed to them, never a cross-tenant inbox. */
    @Transactional(readOnly = true)
    public List<RecruiterConversationResponse> recruiterConversations(UUID recruiterId) {
        Map<UUID, JobApplication> applicationByCandidate = new HashMap<>();
        for (JobApplication application : applicationRepository.findByRecipientRecruiter_Id(recruiterId, Pageable.unpaged())) {
            JobApplication existing = applicationByCandidate.get(application.getCandidate().getId());
            if (existing == null || application.getUpdatedAt().isAfter(existing.getUpdatedAt())) applicationByCandidate.put(application.getCandidate().getId(), application);
        }
        List<RecruiterConversationResponse> conversations = new ArrayList<>();
        for (JobApplication application : applicationByCandidate.values()) {
            UUID candidateId = application.getCandidate().getId();
            DirectMessage latest = messageRepository.recentConversation(recruiterId, candidateId, org.springframework.data.domain.PageRequest.of(0, 1))
                    .stream().findFirst().orElse(null);
            Instant activityAt = latest == null ? application.getUpdatedAt() : latest.getSentAt();
            conversations.add(new RecruiterConversationResponse(candidateId, application.getCandidate().getFullName(), application.getId(),
                    application.getJob().getTitle(), application.getPipelineStage(), latest == null ? null : latest.getBody(),
                    latest == null ? null : latest.getSentAt(), activityAt,
                    messageRepository.countBySenderIdAndRecipientIdAndReadAtIsNull(candidateId, recruiterId)));
        }
        conversations.sort(Comparator.comparing(RecruiterConversationResponse::activityAt).reversed());
        return conversations;
    }

    @Transactional
    public InmailTemplateResponse saveTemplate(UUID recruiterId, InmailTemplateRequest request) {
        Recruiter recruiter = recruiterRepository.findById(recruiterId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter was not found."));
        return InmailTemplateResponse.from(templateRepository.save(InmailTemplate.builder().recruiter(recruiter).templateName(request.name().trim()).subject(request.subject().trim()).bodyHtml(request.bodyHtml().trim()).build()));
    }

    @Transactional(readOnly = true)
    public java.util.List<InmailTemplateResponse> templates(UUID recruiterId) { return templateRepository.findByRecruiter_IdOrderByUpdatedAtDesc(recruiterId).stream().map(InmailTemplateResponse::from).toList(); }

    private void requireConversationAccess(UUID senderId, PlatformRole senderRole, UUID recipientId, JobApplication application) {
        if (senderRole == PlatformRole.RECRUITER) {
            Recruiter recruiter = recruiterRepository.findById(senderId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter was not found."));
            boolean allowed = application != null
                    ? application.getRecipientRecruiter() != null && application.getRecipientRecruiter().getId().equals(recruiter.getId()) && application.getCandidate().getId().equals(recipientId)
                    : applicationRepository.findByRecipientRecruiter_Id(recruiter.getId(), Pageable.unpaged()).stream().anyMatch(item -> item.getCandidate().getId().equals(recipientId));
            if (!allowed) throw denied();
            return;
        }
        if (senderRole == PlatformRole.CANDIDATE) {
            boolean allowed = application != null
                    ? application.getCandidate().getId().equals(senderId) && application.getRecipientRecruiter() != null && application.getRecipientRecruiter().getId().equals(recipientId)
                    : applicationRepository.findByCandidate_Id(senderId, Pageable.unpaged()).stream().anyMatch(item -> item.getRecipientRecruiter() != null && item.getRecipientRecruiter().getId().equals(recipientId));
            if (!allowed) throw denied();
            return;
        }
        throw denied();
    }
    private void queueSecureMessageEmail(UUID senderId, PlatformRole senderRole, UUID recipientId, JobApplication application, String jobTitle) {
        if (senderRole == PlatformRole.RECRUITER) {
            candidateRepository.findById(recipientId).filter(candidate -> candidate.isEmailVerified())
                    .ifPresent(candidate -> transactionalEmailDispatchService.queue(candidate.getId(), candidate.getEmail(),
                            application == null ? null : application.getJob().getPublicJobId(), "New message about " + jobTitle,
                            "<p>You have a new application-linked message in Sapienworx.</p><p>Open your secure workspace to read and reply.</p>"));
            return;
        }
        recruiterRepository.findById(recipientId).filter(Recruiter::isEmailVerified)
                .ifPresent(recruiter -> transactionalEmailDispatchService.queue(recruiter.getId(), recruiter.getOfficialEmail(),
                        application == null ? null : application.getJob().getPublicJobId(), "New candidate message about " + jobTitle,
                        "<p>You have a new application-linked message in Sapienworx.</p><p>Open your secure workspace to read and reply.</p>"));
    }
    private ResponseStatusException denied() { return new ResponseStatusException(HttpStatus.FORBIDDEN, "You can message only people connected to an application."); }
}

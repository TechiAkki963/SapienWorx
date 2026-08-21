package com.sapienworx.api.communication;

import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.events.SseNotificationService;
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

    @Transactional
    @AuditAction(action = "INTERNAL_MESSAGE_SENT", resourceType = "MESSAGE", resourceIdArgumentIndex = -1, candidateIdArgumentIndex = -1)
    public MessageResponse send(UUID senderId, PlatformRole senderRole, MessageRequest request) {
        JobApplication application = request.applicationId() == null ? null : applicationRepository.findById(request.applicationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application was not found."));
        requireConversationAccess(senderId, senderRole, request.recipientId(), application);
        DirectMessage message = messageRepository.save(DirectMessage.builder().senderId(senderId).recipientId(request.recipientId()).jobApplication(application).body(request.body().trim()).build());
        sseNotificationService.sendToUser(request.recipientId(), "MESSAGE_RECEIVED", MessageResponse.from(message));
        return MessageResponse.from(message);
    }

    @Transactional
    public Page<MessageResponse> conversation(UUID userId, UUID counterpartId, Pageable pageable) {
        Page<DirectMessage> messages = messageRepository.conversation(userId, counterpartId, pageable);
        messages.stream().filter(message -> message.getRecipientId().equals(userId) && message.getReadAt() == null).forEach(message -> message.setReadAt(Instant.now()));
        return messages.map(MessageResponse::from);
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
                    ? application.getJob().getOrganisation().getId().equals(recruiter.getOrganisation().getId()) && application.getCandidate().getId().equals(recipientId)
                    : applicationRepository.findByJob_Organisation_Id(recruiter.getOrganisation().getId(), Pageable.unpaged()).stream().anyMatch(item -> item.getCandidate().getId().equals(recipientId));
            if (!allowed) throw denied();
            return;
        }
        if (senderRole == PlatformRole.CANDIDATE) {
            boolean allowed = application != null
                    ? application.getCandidate().getId().equals(senderId) && application.getJob().getOrganisation().getRecruiters().stream().anyMatch(recruiter -> recruiter.getId().equals(recipientId))
                    : applicationRepository.findByCandidate_Id(senderId, Pageable.unpaged()).stream().anyMatch(item -> item.getJob().getOrganisation().getRecruiters().stream().anyMatch(recruiter -> recruiter.getId().equals(recipientId)));
            if (!allowed) throw denied();
            return;
        }
        throw denied();
    }
    private ResponseStatusException denied() { return new ResponseStatusException(HttpStatus.FORBIDDEN, "You can message only people connected to an application."); }
}

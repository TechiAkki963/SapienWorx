package com.sapienworx.api.communication;

import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecruiterTemplateManagementService {
    private final InmailTemplateRepository templateRepository;
    private final RecruiterRepository recruiterRepository;

    @Transactional
    public InmailTemplateResponse update(UUID recruiterId, UUID templateId, InmailTemplateRequest request) {
        InmailTemplate template = owned(recruiterId, templateId);
        template.setTemplateName(request.name().trim());
        template.setSubject(request.subject().trim());
        template.setBodyHtml(request.bodyHtml().trim());
        return InmailTemplateResponse.from(templateRepository.save(template));
    }

    @Transactional
    public void delete(UUID recruiterId, UUID templateId) {
        templateRepository.delete(owned(recruiterId, templateId));
    }

    private InmailTemplate owned(UUID recruiterId, UUID templateId) {
        Recruiter recruiter = recruiterRepository.findById(recruiterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter was not found."));
        return templateRepository.findById(templateId)
                .filter(template -> template.getRecruiter().getId().equals(recruiter.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Template was not found."));
    }
}

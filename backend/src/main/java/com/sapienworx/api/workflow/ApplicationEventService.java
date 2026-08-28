package com.sapienworx.api.workflow;

import com.sapienworx.api.application.JobApplication;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApplicationEventService {
    private final ApplicationEventRepository applicationEventRepository;

    @Transactional
    public void record(JobApplication application, String actorType, String eventType, String summary) {
        applicationEventRepository.save(ApplicationEvent.builder().application(application).actorType(actorType)
                .eventType(eventType).eventSummary(summary).build());
    }
}

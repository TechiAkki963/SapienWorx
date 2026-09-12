package com.sapienworx.api.workflow;

import com.sapienworx.api.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class RecruitmentEvolutionController {
    private final RecruitmentEvolutionService service;

    @GetMapping("/api/recruiter/evolution/collaboration")
    public Map<String,Object> collaboration(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user){return service.collaboration(userId(user));}

    @PatchMapping("/api/recruiter/evolution/saved-searches/{id}/visibility")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void savedSearchVisibility(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@PathVariable UUID id,@RequestBody RecruitmentEvolutionService.VisibilityRequest request){service.updateSavedSearchVisibility(userId(user),id,request.visibility());}

    @PatchMapping("/api/recruiter/evolution/talent-pools/{id}/visibility")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void poolVisibility(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@PathVariable UUID id,@RequestBody RecruitmentEvolutionService.VisibilityRequest request){service.updatePoolVisibility(userId(user),id,request.visibility());}

    @GetMapping("/api/recruiter/evolution/rediscovery")
    public Map<String,Object> rediscovery(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@RequestParam String jobId,@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="50") int limit){return service.jobAwareRediscovery(userId(user),jobId,query,limit);}

    @PostMapping("/api/recruiter/evolution/bulk/talent-pool")
    public Map<String,Object> bulkPool(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@RequestBody RecruitmentEvolutionService.BulkPoolRequest request){return service.bulkAddToPool(userId(user),request);}

    @GetMapping("/api/recruiter/evolution/jobs/{jobId}/hiring-plan")
    public Map<String,Object> hiringPlan(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@PathVariable String jobId){return service.hiringPlan(userId(user),jobId);}

    @PutMapping("/api/recruiter/evolution/jobs/{jobId}/hiring-plan")
    public Map<String,Object> saveHiringPlan(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@PathVariable String jobId,@RequestBody RecruitmentEvolutionService.HiringPlanRequest request){return service.saveHiringPlan(userId(user),jobId,request);}

    @PostMapping("/api/recruiter/evolution/applications/{applicationId}/interview-slots")
    public Map<String,Object> createSlots(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@PathVariable UUID applicationId,@RequestBody RecruitmentEvolutionService.SlotBatchRequest request){return service.createInterviewSlots(userId(user),applicationId,request);}

    @GetMapping("/api/candidate/evolution/applications/{applicationId}/journey")
    public Map<String,Object> journey(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@PathVariable UUID applicationId){return service.candidateJourney(userId(user),applicationId);}

    @GetMapping("/api/candidate/evolution/applications/{applicationId}/interview-slots")
    public List<Map<String,Object>> slots(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@PathVariable UUID applicationId){return service.candidateSlots(userId(user),applicationId);}

    @PostMapping("/api/candidate/evolution/applications/{applicationId}/interview-slots/{slotId}/book")
    public Map<String,Object> book(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@PathVariable UUID applicationId,@PathVariable UUID slotId){return service.bookSlot(userId(user),applicationId,slotId);}

    @PutMapping("/api/candidate/evolution/applications/{applicationId}/experience-survey")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void survey(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user,@PathVariable UUID applicationId,@RequestBody RecruitmentEvolutionService.SurveyRequest request){service.submitExperienceSurvey(userId(user),applicationId,request);}

    private UUID userId(AuthenticatedUser user){if(user==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Authentication is required.");return user.userId();}
}

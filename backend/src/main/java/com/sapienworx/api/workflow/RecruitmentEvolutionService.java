package com.sapienworx.api.workflow;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.recruiter.HiringLifecycleService;
import com.sapienworx.api.recruiter.InterviewRequest;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class RecruitmentEvolutionService {
    private final RecruiterRepository recruiters;
    private final JobRepository jobs;
    private final JobApplicationRepository applications;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final HiringLifecycleService hiringLifecycle;

    @Transactional(readOnly = true)
    public Map<String, Object> collaboration(UUID recruiterId) {
        Recruiter recruiter = recruiter(recruiterId);
        UUID organisationId = recruiter.getOrganisation().getId();
        List<Map<String, Object>> searches = jdbc.query("""
                select s.id, s.search_name, s.alert_frequency, s.visibility, s.updated_at,
                       r.id owner_recruiter_id, r.full_name owner_name,
                       (s.recruiter_id = ?) editable
                from recruiter_saved_searches s
                join recruiters r on r.id = s.recruiter_id
                where s.recruiter_id = ?
                   or (s.visibility = 'ORGANISATION' and r.organisation_id = ?)
                order by s.updated_at desc
                """, (rs, row) -> linkedMap(
                "id", rs.getObject("id", UUID.class), "name", rs.getString("search_name"),
                "alertFrequency", rs.getString("alert_frequency"), "visibility", rs.getString("visibility"),
                "updatedAt", instant(rs.getTimestamp("updated_at")), "ownerRecruiterId", rs.getObject("owner_recruiter_id", UUID.class),
                "ownerName", rs.getString("owner_name"), "editable", rs.getBoolean("editable")
        ), recruiterId, recruiterId, organisationId);
        List<Map<String, Object>> pools = jdbc.query("""
                select p.id, p.pool_name, p.description, p.visibility, p.updated_at,
                       r.id owner_recruiter_id, r.full_name owner_name,
                       (p.created_by_recruiter_id = ?) editable,
                       (select count(*) from talent_pool_candidates m where m.talent_pool_id = p.id) candidate_count
                from talent_pools p join recruiters r on r.id = p.created_by_recruiter_id
                where p.organisation_id = ?
                  and (p.visibility = 'ORGANISATION' or p.created_by_recruiter_id = ?)
                order by p.updated_at desc
                """, (rs, row) -> linkedMap(
                "id", rs.getObject("id", UUID.class), "name", rs.getString("pool_name"), "description", rs.getString("description"),
                "visibility", rs.getString("visibility"), "updatedAt", instant(rs.getTimestamp("updated_at")),
                "ownerRecruiterId", rs.getObject("owner_recruiter_id", UUID.class), "ownerName", rs.getString("owner_name"),
                "editable", rs.getBoolean("editable"), "candidateCount", rs.getLong("candidate_count")
        ), recruiterId, organisationId, recruiterId);
        return linkedMap("savedSearches", searches, "talentPools", pools);
    }

    @Transactional
    public void updateSavedSearchVisibility(UUID recruiterId, UUID id, String visibility) {
        requireVisibility(visibility);
        int changed = jdbc.update("update recruiter_saved_searches set visibility=?, updated_at=now() where id=? and recruiter_id=?",
                visibility, id, recruiterId);
        if (changed == 0) throw notFound("Saved search was not found or is owned by another recruiter.");
    }

    @Transactional
    public void updatePoolVisibility(UUID recruiterId, UUID id, String visibility) {
        requireVisibility(visibility);
        int changed = jdbc.update("update talent_pools set visibility=?, updated_at=now() where id=? and created_by_recruiter_id=?",
                visibility, id, recruiterId);
        if (changed == 0) throw notFound("Talent pool was not found or is owned by another recruiter.");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> jobAwareRediscovery(UUID recruiterId, String publicJobId, String query, int requestedLimit) {
        Recruiter recruiter = recruiter(recruiterId);
        Job job = job(recruiter, publicJobId);
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String like = "%" + q + "%";
        int limit = Math.max(1, Math.min(requestedLimit, 100));
        List<Map<String, Object>> candidates = jdbc.query("""
                with candidate_history as (
                    select c.id, c.full_name, c.headline, c.location, c.current_company,
                           c.overall_experience_years, c.notice_period_days, c.last_active_at,
                           max(a.applied_at) last_applied_at,
                           count(distinct a.id) application_count,
                           bool_or(a.pipeline_stage in ('INTERVIEWING','FINAL_STAGE','OFFER','ONBOARDED')) interviewed_before,
                           bool_or(a.pipeline_stage in ('FINAL_STAGE','OFFER','ONBOARDED')) reached_final_stage,
                           count(distinct case when lower(cs.skill) = lower(js.skill) then cs.skill end) overlap_count,
                           coalesce(string_agg(distinct case when lower(cs.skill) = lower(js.skill) then cs.skill end, ', '), '') overlap_skills
                    from candidates c
                    join job_applications a on a.candidate_id=c.id
                    join jobs historical_job on historical_job.internal_id=a.job_internal_id and historical_job.organisation_id=?
                    left join candidate_skills cs on cs.candidate_id=c.id
                    left join job_skills js on js.job_internal_id=?
                    where c.profile_searchable=true
                      and (?='' or lower(c.full_name) like ? or lower(coalesce(c.headline,'')) like ?
                           or lower(coalesce(c.current_company,'')) like ?
                           or exists(select 1 from candidate_skills sx where sx.candidate_id=c.id and lower(sx.skill) like ?))
                    group by c.id,c.full_name,c.headline,c.location,c.current_company,c.overall_experience_years,c.notice_period_days,c.last_active_at
                )
                select * from candidate_history
                order by overlap_count desc, reached_final_stage desc, interviewed_before desc, last_applied_at desc
                limit ?
                """, (rs, row) -> {
            List<String> overlaps = split(rs.getString("overlap_skills"));
            List<String> evidence = new ArrayList<>();
            if (!overlaps.isEmpty()) evidence.add(overlaps.size() + " required skill" + (overlaps.size() == 1 ? " overlaps" : "s overlap"));
            if (rs.getBoolean("reached_final_stage")) evidence.add("Reached a final hiring stage before");
            else if (rs.getBoolean("interviewed_before")) evidence.add("Previously interviewed");
            int applications = rs.getInt("application_count");
            if (applications > 1) evidence.add(applications + " previous applications");
            return linkedMap(
                    "candidateId", rs.getObject("id", UUID.class), "fullName", rs.getString("full_name"),
                    "headline", rs.getString("headline"), "location", rs.getString("location"), "currentCompany", rs.getString("current_company"),
                    "experienceYears", nullableInt(rs, "overall_experience_years"), "noticePeriodDays", nullableInt(rs, "notice_period_days"),
                    "lastActiveAt", instant(rs.getTimestamp("last_active_at")), "lastAppliedAt", instant(rs.getTimestamp("last_applied_at")),
                    "applicationCount", applications, "interviewedBefore", rs.getBoolean("interviewed_before"),
                    "reachedFinalStage", rs.getBoolean("reached_final_stage"), "overlapSkills", overlaps, "evidence", evidence
            );
        }, recruiter.getOrganisation().getId(), job.getInternalId(), q, like, like, like, like, limit);
        return linkedMap("jobId", job.getPublicJobId(), "jobTitle", job.getTitle(), "requiredSkills", new ArrayList<>(job.getSkills()), "candidates", candidates);
    }

    @Transactional
    public Map<String, Object> bulkAddToPool(UUID recruiterId, BulkPoolRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        UUID organisationId = recruiter.getOrganisation().getId();
        Map<String, Object> pool = jdbc.query("""
                select id, visibility, created_by_recruiter_id from talent_pools
                where id=? and organisation_id=? and (visibility='ORGANISATION' or created_by_recruiter_id=?)
                """, rs -> rs.next() ? linkedMap("id", rs.getObject("id", UUID.class)) : null, request.poolId(), organisationId, recruiterId);
        if (pool == null) throw notFound("Talent pool was not found or is private to another recruiter.");
        UUID owner = request.ownerRecruiterId();
        if (owner != null) requireRecruiterInOrganisation(owner, organisationId);
        List<UUID> ids = request.candidateIds() == null ? List.of() : request.candidateIds().stream().filter(Objects::nonNull).distinct().limit(200).toList();
        if (ids.isEmpty()) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose at least one candidate.");
        int added = 0;
        for (UUID candidateId : ids) {
            Boolean searchable = jdbc.query("select profile_searchable from candidates where id=?", rs -> rs.next() ? rs.getBoolean(1) : null, candidateId);
            if (!Boolean.TRUE.equals(searchable)) continue;
            jdbc.update("""
                    insert into talent_pool_candidates(id,talent_pool_id,candidate_id,added_by_recruiter_id,owner_recruiter_id,tags,reminder_at,collaboration_note,next_action,created_at,updated_at)
                    values(?,?,?,?,?,cast(? as jsonb),?,?,?,now(),now())
                    on conflict(talent_pool_id,candidate_id) do update set
                        owner_recruiter_id=coalesce(excluded.owner_recruiter_id,talent_pool_candidates.owner_recruiter_id),
                        reminder_at=coalesce(excluded.reminder_at,talent_pool_candidates.reminder_at),
                        next_action=coalesce(excluded.next_action,talent_pool_candidates.next_action), updated_at=now()
                    """, UUID.randomUUID(), request.poolId(), candidateId, recruiterId, owner,
                    json(List.of("Job rediscovery")), request.reminderAt(), null, trim(request.nextAction()));
            added++;
        }
        return linkedMap("requested", ids.size(), "addedOrUpdated", added);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> hiringPlan(UUID recruiterId, String publicJobId) {
        Recruiter recruiter = recruiter(recruiterId);
        Job job = job(recruiter, publicJobId);
        Map<String, Object> plan = jdbc.query("""
                select hiring_reason,six_month_success,must_have_skills::text,nice_to_have_skills::text,
                       decision_maker_ids::text,target_sla_days,updated_at
                from job_hiring_plans where job_internal_id=?
                """, rs -> rs.next() ? linkedMap(
                "hiringReason", rs.getString("hiring_reason"), "sixMonthSuccess", rs.getString("six_month_success"),
                "mustHaveSkills", jsonList(rs.getString("must_have_skills")), "niceToHaveSkills", jsonList(rs.getString("nice_to_have_skills")),
                "decisionMakerIds", jsonUuidList(rs.getString("decision_maker_ids")), "targetSlaDays", nullableInt(rs,"target_sla_days"),
                "updatedAt", instant(rs.getTimestamp("updated_at"))) : null, job.getInternalId());
        List<Map<String, Object>> stages = jdbc.query("""
                select id,stage_order,stage_name,purpose,scorecard_criteria::text,assigned_recruiter_ids::text
                from job_hiring_stages where job_internal_id=? order by stage_order
                """, (rs,row) -> linkedMap("id",rs.getObject("id",UUID.class),"order",rs.getInt("stage_order"),"name",rs.getString("stage_name"),
                "purpose",rs.getString("purpose"),"criteria",jsonList(rs.getString("scorecard_criteria")),
                "assignedRecruiterIds",jsonUuidList(rs.getString("assigned_recruiter_ids"))), job.getInternalId());
        return linkedMap("jobId",job.getPublicJobId(),"jobTitle",job.getTitle(),"plan",plan,"stages",stages);
    }

    @Transactional
    public Map<String, Object> saveHiringPlan(UUID recruiterId, String publicJobId, HiringPlanRequest request) {
        Recruiter recruiter = recruiter(recruiterId);
        Job job = job(recruiter, publicJobId);
        UUID orgId = recruiter.getOrganisation().getId();
        List<UUID> decisionMakers = cleanIds(request.decisionMakerIds());
        decisionMakers.forEach(id -> requireRecruiterInOrganisation(id, orgId));
        jdbc.update("""
                insert into job_hiring_plans(job_internal_id,organisation_id,created_by_recruiter_id,hiring_reason,six_month_success,must_have_skills,nice_to_have_skills,decision_maker_ids,target_sla_days,created_at,updated_at)
                values(?,?,?,?,?,cast(? as jsonb),cast(? as jsonb),cast(? as jsonb),?,now(),now())
                on conflict(job_internal_id) do update set hiring_reason=excluded.hiring_reason,six_month_success=excluded.six_month_success,
                  must_have_skills=excluded.must_have_skills,nice_to_have_skills=excluded.nice_to_have_skills,decision_maker_ids=excluded.decision_maker_ids,
                  target_sla_days=excluded.target_sla_days,updated_at=now()
                """, job.getInternalId(),orgId,recruiterId,trim(request.hiringReason()),trim(request.sixMonthSuccess()),
                json(cleanStrings(request.mustHaveSkills(),20,80)),json(cleanStrings(request.niceToHaveSkills(),20,80)),json(decisionMakers),request.targetSlaDays());
        jdbc.update("delete from job_hiring_stages where job_internal_id=?",job.getInternalId());
        int order=1;
        for (HiringStageRequest stage : request.stages()==null?List.<HiringStageRequest>of():request.stages().stream().limit(20).toList()) {
            if (stage.name()==null || stage.name().isBlank()) continue;
            List<UUID> assigned=cleanIds(stage.assignedRecruiterIds()); assigned.forEach(id -> requireRecruiterInOrganisation(id,orgId));
            jdbc.update("insert into job_hiring_stages(id,job_internal_id,stage_order,stage_name,purpose,scorecard_criteria,assigned_recruiter_ids,created_at,updated_at) values(?,?,?,?,?,cast(? as jsonb),cast(? as jsonb),now(),now())",
                    UUID.randomUUID(),job.getInternalId(),order++,stage.name().trim(),trim(stage.purpose()),json(cleanStrings(stage.criteria(),12,120)),json(assigned));
        }
        return hiringPlan(recruiterId,publicJobId);
    }

    @Transactional
    public Map<String, Object> createInterviewSlots(UUID recruiterId, UUID applicationId, SlotBatchRequest request) {
        Recruiter recruiter=recruiter(recruiterId); JobApplication application=applicationForRecruiter(recruiter,applicationId);
        if (request.slots()==null || request.slots().isEmpty()) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Add at least one interview slot.");
        int created=0;
        for (SlotRequest slot:request.slots().stream().limit(20).toList()) {
            if (slot.startsAt()==null || !slot.startsAt().isAfter(Instant.now())) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Interview slots must be in the future.");
            requireHttps(slot.externalMeetingUrl());
            int duration=slot.durationMinutes()==null?30:slot.durationMinutes();
            if(duration<5||duration>480) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Interview duration must be between 5 and 480 minutes.");
            jdbc.update("insert into candidate_interview_slots(id,application_id,recruiter_id,starts_at,duration_minutes,time_zone,external_meeting_url,status,created_at,updated_at) values(?,?,?,?,?,?,?,'AVAILABLE',now(),now())",
                    UUID.randomUUID(),application.getId(),recruiterId,slot.startsAt(),duration,slot.timeZone()==null||slot.timeZone().isBlank()?"Asia/Kolkata":slot.timeZone().trim(),slot.externalMeetingUrl().trim()); created++;
        }
        return linkedMap("created",created);
    }

    @Transactional(readOnly = true)
    public Map<String,Object> candidateJourney(UUID candidateId, UUID applicationId) {
        JobApplication application=applicationForCandidate(candidateId,applicationId);
        List<Map<String,Object>> events=new ArrayList<>();
        events.add(linkedMap("type","APPLICATION_SUBMITTED","label","Application submitted","at",application.getAppliedAt()));
        jdbc.query("select event_type,created_at from application_events where application_id=? order by created_at", rs -> {
            while(rs.next()) events.add(linkedMap("type",rs.getString("event_type"),"label",candidateSafeEventLabel(rs.getString("event_type")),"at",instant(rs.getTimestamp("created_at"))));
            return null;
        },applicationId);
        List<Map<String,Object>> interviews=jdbc.query("select id,platform_name,meeting_link,scheduled_at,duration_minutes,status from interviews where job_application_id=? order by scheduled_at",
                (rs,row)->linkedMap("id",rs.getObject("id",UUID.class),"platformName",rs.getString("platform_name"),"meetingLink",rs.getString("meeting_link"),
                        "scheduledAt",instant(rs.getTimestamp("scheduled_at")),"durationMinutes",rs.getInt("duration_minutes"),"status",rs.getString("status")),applicationId);
        Map<String,Object> offer=jdbc.query("select status,designation,joining_date,expires_at,responded_at from offers where application_id=?",
                rs->rs.next()?linkedMap("status",rs.getString("status"),"designation",rs.getString("designation"),"joiningDate",rs.getDate("joining_date"),
                        "expiresAt",instant(rs.getTimestamp("expires_at")),"respondedAt",instant(rs.getTimestamp("responded_at"))):null,applicationId);
        return linkedMap("applicationId",applicationId,"jobId",application.getJob().getPublicJobId(),"jobTitle",application.getJob().getTitle(),
                "currentStage",application.getPipelineStage().name(),"appliedAt",application.getAppliedAt(),"updatedAt",application.getUpdatedAt(),
                "nextAction",candidateNextAction(application,interviews,offer),"timeline",events,"interviews",interviews,"offer",offer);
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> candidateSlots(UUID candidateId, UUID applicationId) {
        applicationForCandidate(candidateId,applicationId);
        return jdbc.query("select id,starts_at,duration_minutes,time_zone,status from candidate_interview_slots where application_id=? and status in ('AVAILABLE','BOOKED') order by starts_at",
                (rs,row)->linkedMap("id",rs.getObject("id",UUID.class),"startsAt",instant(rs.getTimestamp("starts_at")),"durationMinutes",rs.getInt("duration_minutes"),"timeZone",rs.getString("time_zone"),"status",rs.getString("status")),applicationId);
    }

    @Transactional
    public Map<String,Object> bookSlot(UUID candidateId, UUID applicationId, UUID slotId) {
        applicationForCandidate(candidateId,applicationId);
        Map<String,Object> slot=jdbc.query("select recruiter_id,starts_at,duration_minutes,time_zone,external_meeting_url,status from candidate_interview_slots where id=? and application_id=? for update",
                rs->rs.next()?linkedMap("recruiterId",rs.getObject("recruiter_id",UUID.class),"startsAt",instant(rs.getTimestamp("starts_at")),"duration",rs.getInt("duration_minutes"),
                        "timeZone",rs.getString("time_zone"),"url",rs.getString("external_meeting_url"),"status",rs.getString("status")):null,slotId,applicationId);
        if(slot==null) throw notFound("Interview slot was not found.");
        if(!"AVAILABLE".equals(slot.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"This interview slot is no longer available.");
        Instant starts=(Instant)slot.get("startsAt"); if(starts==null||!starts.isAfter(Instant.now())) throw new ResponseStatusException(HttpStatus.CONFLICT,"This interview slot has expired.");
        hiringLifecycle.scheduleInterview((UUID)slot.get("recruiterId"),new InterviewRequest(applicationId,"External meeting",(String)slot.get("url"),starts,(Integer)slot.get("duration"),(String)slot.get("timeZone"),"Candidate-selected interview slot",List.of()));
        jdbc.update("update candidate_interview_slots set status='BOOKED',booked_at=now(),updated_at=now() where id=?",slotId);
        jdbc.update("update candidate_interview_slots set status='WITHDRAWN',updated_at=now() where application_id=? and id<>? and status='AVAILABLE'",applicationId,slotId);
        return linkedMap("slotId",slotId,"status","BOOKED","scheduledAt",starts);
    }

    @Transactional
    public void submitExperienceSurvey(UUID candidateId, UUID applicationId, SurveyRequest request) {
        applicationForCandidate(candidateId,applicationId);
        if(request.rating()<1||request.rating()>5) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Rating must be between 1 and 5.");
        jdbc.update("""
                insert into candidate_experience_surveys(id,application_id,candidate_id,rating,feedback,submitted_at)
                values(?,?,?,?,?,now()) on conflict(application_id,candidate_id) do update set rating=excluded.rating,feedback=excluded.feedback,submitted_at=now()
                """,UUID.randomUUID(),applicationId,candidateId,request.rating(),trim(request.feedback()));
    }

    private Recruiter recruiter(UUID id){return recruiters.findById(id).orElseThrow(()->notFound("Recruiter profile was not found."));}
    private Job job(Recruiter recruiter,String publicId){return jobs.findByPublicJobId(publicId).filter(j->j.getOrganisation().getId().equals(recruiter.getOrganisation().getId())).orElseThrow(()->notFound("Job was not found in your organisation."));}
    private JobApplication applicationForRecruiter(Recruiter recruiter,UUID id){return applications.findById(id).filter(a->a.getJob().getOrganisation().getId().equals(recruiter.getOrganisation().getId())).orElseThrow(()->notFound("Application was not found in your organisation."));}
    private JobApplication applicationForCandidate(UUID candidateId,UUID id){return applications.findById(id).filter(a->a.getCandidate().getId().equals(candidateId)).orElseThrow(()->notFound("Application was not found."));}
    private void requireRecruiterInOrganisation(UUID id,UUID org){Recruiter value=recruiters.findById(id).orElseThrow(()->notFound("Recruiter was not found."));if(!value.getOrganisation().getId().equals(org))throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Recruiter must belong to your organisation.");}
    private void requireVisibility(String value){if(!"PRIVATE".equals(value)&&!"ORGANISATION".equals(value))throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Visibility must be PRIVATE or ORGANISATION.");}
    private void requireHttps(String value){try{URI uri=URI.create(value==null?"":value.trim());if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null)throw new IllegalArgumentException();}catch(Exception e){throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"External meeting URL must use HTTPS.");}}
    private ResponseStatusException notFound(String message){return new ResponseStatusException(HttpStatus.NOT_FOUND,message);}
    private String trim(String value){return value==null||value.isBlank()?null:value.trim();}
    private List<String> cleanStrings(List<String> values,int max,int length){if(values==null)return List.of();return values.stream().filter(Objects::nonNull).map(String::trim).filter(v->!v.isBlank()).map(v->v.substring(0,Math.min(v.length(),length))).distinct().limit(max).toList();}
    private List<UUID> cleanIds(List<UUID> values){return values==null?List.of():values.stream().filter(Objects::nonNull).distinct().limit(50).toList();}
    private String json(Object value){try{return objectMapper.writeValueAsString(value);}catch(JsonProcessingException e){throw new IllegalStateException(e);}}
    private List<String> jsonList(String value){try{return value==null?List.of():objectMapper.readValue(value,new TypeReference<>(){});}catch(Exception e){return List.of();}}
    private List<UUID> jsonUuidList(String value){try{return value==null?List.of():objectMapper.readValue(value,new TypeReference<>(){});}catch(Exception e){return List.of();}}
    private List<String> split(String value){return value==null||value.isBlank()?List.of():Arrays.stream(value.split(",\\s*")).filter(v->!v.isBlank()).toList();}
    private Instant instant(Timestamp value){return value==null?null:value.toInstant();}
    private Integer nullableInt(java.sql.ResultSet rs,String column)throws java.sql.SQLException{int value=rs.getInt(column);return rs.wasNull()?null:value;}
    private String candidateSafeEventLabel(String type){return switch(type){case "INTERVIEW_SCHEDULED"->"Interview scheduled";case "INTERVIEW_RESCHEDULED"->"Interview rescheduled";case "INTERVIEW_CANCELLED"->"Interview cancelled";case "INTERVIEW_UPDATED"->"Interview details updated";case "OFFER_SENT"->"Offer sent";case "OFFER_ACCEPTED"->"Offer accepted";case "OFFER_DECLINED"->"Offer declined";case "STAGE_CHANGED","PIPELINE_STAGE_CHANGED"->"Application stage updated";default->"Application activity updated";};}
    private String candidateNextAction(JobApplication app,List<Map<String,Object>> interviews,Map<String,Object> offer){String stage=app.getPipelineStage().name();if("REJECTED".equals(stage))return "No action required";if("ONBOARDED".equals(stage))return "Hiring complete";if(offer!=null&&"SENT".equals(offer.get("status")))return "Review your offer";boolean upcoming=interviews.stream().anyMatch(i->{Object at=i.get("scheduledAt");return at instanceof Instant instant&&instant.isAfter(Instant.now())&&!"CANCELLED".equals(i.get("status"));});if(upcoming)return "Prepare for your upcoming interview";if("INTERVIEWING".equals(stage)||"FINAL_STAGE".equals(stage))return "Watch for the next interview update";return "No action needed — the hiring team is reviewing your application";}
    @SafeVarargs private final <K,V> Map<K,V> linkedMap(Object... pairs){Map<K,V> result=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2){@SuppressWarnings("unchecked")K k=(K)pairs[i];@SuppressWarnings("unchecked")V v=(V)pairs[i+1];result.put(k,v);}return result;}

    public record VisibilityRequest(String visibility){}
    public record BulkPoolRequest(UUID poolId,List<UUID> candidateIds,UUID ownerRecruiterId,Instant reminderAt,String nextAction){}
    public record HiringPlanRequest(String hiringReason,String sixMonthSuccess,List<String> mustHaveSkills,List<String> niceToHaveSkills,List<UUID> decisionMakerIds,Integer targetSlaDays,List<HiringStageRequest> stages){}
    public record HiringStageRequest(String name,String purpose,List<String> criteria,List<UUID> assignedRecruiterIds){}
    public record SlotBatchRequest(List<SlotRequest> slots){}
    public record SlotRequest(Instant startsAt,Integer durationMinutes,String timeZone,String externalMeetingUrl){}
    public record SurveyRequest(int rating,String feedback){}
}

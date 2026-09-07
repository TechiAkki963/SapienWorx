package com.sapienworx.api.communication;

import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.interview.Interview;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Delivers privacy-conscious interview scheduling updates through the activity feed and the protected email queue. */
@Service
@RequiredArgsConstructor
public class InterviewNotificationDeliveryService {
    private static final DateTimeFormatter ICS_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneId.of("UTC"));
    private final NotificationService notificationService;
    private final TransactionalEmailDispatchService emailDispatchService;
    private final RecruiterRepository recruiterRepository;

    @Value("${app.public-url:http://localhost:3001}")
    private String publicUrl;

    public void deliver(Interview interview, Change change) {
        Candidate candidate = interview.getApplication().getCandidate();
        String jobTitle = interview.getApplication().getJob().getTitle();
        String eventTitle = "Interview " + change.label();
        String candidateBody = switch (change) {
            case SCHEDULED -> "Your interview for " + jobTitle + " has been scheduled. Check the secure details and your calendar invitation.";
            case RESCHEDULED -> "Your interview for " + jobTitle + " has a new time. Check the secure details and updated calendar invitation.";
            case CANCELLED -> "Your interview for " + jobTitle + " has been cancelled. The calendar invitation has been withdrawn.";
            case UPDATED -> "Your interview details for " + jobTitle + " have been updated. Check the secure details and calendar invitation.";
        };
        notificationService.create(candidate.getId(), "INTERVIEW_" + change.name(), eventTitle, candidateBody, "INTERVIEW", interview.getId());
        if (candidate.isEmailVerified()) {
            emailDispatchService.queue(candidate.getId(), candidate.getEmail(), interview.getApplication().getJob().getPublicJobId(),
                    eventTitle + ": " + jobTitle, candidateEmailHtml(candidateBody), calendarFilename(interview), calendarContent(interview, change));
        }

        Map<UUID, Recruiter> interviewTeam = new LinkedHashMap<>();
        interviewTeam.put(interview.getRecruiter().getId(), interview.getRecruiter());
        List<UUID> panelIds = interview.getPanelRecruiterIds() == null ? List.of() : interview.getPanelRecruiterIds();
        recruiterRepository.findAllById(panelIds).forEach(member -> interviewTeam.put(member.getId(), member));
        for (Recruiter member : interviewTeam.values()) {
            if (!member.getId().equals(interview.getRecruiter().getId())) {
                notificationService.create(member.getId(), "INTERVIEW_PANEL_" + change.name(), eventTitle,
                        "An interview panel update for " + jobTitle + " needs your attention.", "INTERVIEW", interview.getId());
            }
            if (member.isEmailVerified()) {
                emailDispatchService.queue(member.getId(), member.getOfficialEmail(), interview.getApplication().getJob().getPublicJobId(),
                        eventTitle + ": " + jobTitle, recruiterEmailHtml(jobTitle, change), calendarFilename(interview), calendarContent(interview, change));
            }
        }
    }

    private String candidateEmailHtml(String body) {
        return "<p>" + escape(body) + "</p><p>Open <a href=\"" + escape(portalUrl("/candidate/applications")) + "\">your Sapienworx workspace</a> to view or join securely.</p>";
    }

    private String recruiterEmailHtml(String jobTitle, Change change) {
        return "<p>An interview for <strong>" + escape(jobTitle) + "</strong> was " + escape(change.emailVerb()) + ".</p>"
                + "<p>Open <a href=\"" + escape(portalUrl("/recruiter/workbench#interviews")) + "\">Recruitment Workspace</a> for secure interview details.</p>";
    }

    private String calendarFilename(Interview interview) { return "sapienworx-interview-" + interview.getId() + ".ics"; }

    private String calendarContent(Interview interview, Change change) {
        Instant end = interview.getScheduledAt().plusSeconds(interview.getDurationMinutes() * 60L);
        String summary = "Sapienworx interview: " + interview.getApplication().getJob().getTitle();
        String description = "Manage secure interview details in Sapienworx: " + portalUrl("/candidate/applications");
        String method = change == Change.CANCELLED ? "CANCEL" : "REQUEST";
        String status = change == Change.CANCELLED ? "STATUS:CANCELLED\\r\\n" : "";
        return "BEGIN:VCALENDAR\\r\\nVERSION:2.0\\r\\nPRODID:-//Sapienworx//Interview//EN\\r\\nCALSCALE:GREGORIAN\\r\\nMETHOD:" + method + "\\r\\nBEGIN:VEVENT\\r\\n"
                + "UID:" + interview.getId() + "@sapienworx\\r\\nSEQUENCE:" + (change == Change.SCHEDULED ? 0 : 1) + "\\r\\nDTSTAMP:" + ICS_TIME.format(Instant.now()) + "\\r\\n"
                + "DTSTART:" + ICS_TIME.format(interview.getScheduledAt()) + "\\r\\nDTEND:" + ICS_TIME.format(end) + "\\r\\n"
                + status + "SUMMARY:" + ics(summary) + "\\r\\nDESCRIPTION:" + ics(description) + "\\r\\nLOCATION:" + ics(interview.getPlatformName()) + "\\r\\nEND:VEVENT\\r\\nEND:VCALENDAR\\r\\n";
    }

    private String portalUrl(String path) { return publicUrl.replaceAll("/+$", "") + path; }
    private String escape(String value) { return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;"); }
    private String ics(String value) { return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r", "").replace("\n", "\\n"); }

    public enum Change {
        SCHEDULED("scheduled", "scheduled"), RESCHEDULED("rescheduled", "rescheduled"), CANCELLED("cancelled", "cancelled"), UPDATED("updated", "updated");
        private final String label;
        private final String emailVerb;
        Change(String label, String emailVerb) { this.label = label; this.emailVerb = emailVerb; }
        public String label() { return label; }
        public String emailVerb() { return emailVerb; }
    }
}

package intelligence

type Snapshot struct {
	ActiveJobs             int64 `json:"active_jobs"`
	Applications30d        int64 `json:"applications_30d"`
	Interviews30d          int64 `json:"interviews_30d"`
	Hires90d               int64 `json:"hires_90d"`
	ParserEvents24h        int64 `json:"parser_events_24h"`
	ParserFailures24h      int64 `json:"parser_failures_24h"`
	CriticalAlerts         int64 `json:"critical_alerts"`
	PendingPrivacyRequests int64 `json:"pending_privacy_requests"`
	PendingApprovals       int64 `json:"pending_approvals"`
}
type Insight struct {
	Domain         string         `json:"domain"`
	Key            string         `json:"key"`
	Severity       string         `json:"severity"`
	Title          string         `json:"title"`
	Rationale      string         `json:"rationale"`
	Evidence       map[string]any `json:"evidence"`
	Recommendation string         `json:"recommendation"`
	Confidence     float64        `json:"confidence"`
}

const EngineVersion = "rules-v1"

func Analyze(s Snapshot) []Insight {
	out := make([]Insight, 0)
	if s.ActiveJobs >= 5 && s.Applications30d < s.ActiveJobs*2 {
		out = append(out, Insight{Domain: "recruitment", Key: "recruitment.low_application_flow", Severity: "watch", Title: "Application flow is low relative to active jobs", Rationale: "Recent application volume is below two applications per active job; this may reflect sourcing, discoverability, job quality, or a normal low-volume period.", Evidence: map[string]any{"active_jobs": s.ActiveJobs, "applications_30d": s.Applications30d}, Recommendation: "Review source mix and job-level conversion before changing matching or sourcing rules.", Confidence: .72})
	}
	if s.Applications30d >= 20 && s.Interviews30d*20 < s.Applications30d {
		out = append(out, Insight{Domain: "recruitment", Key: "recruitment.low_interview_conversion", Severity: "watch", Title: "Application-to-interview conversion is low", Rationale: "Fewer than roughly five percent of recent applications have corresponding interview activity in the analysis window.", Evidence: map[string]any{"applications_30d": s.Applications30d, "interviews_30d": s.Interviews30d}, Recommendation: "Inspect screening criteria and job-specific funnels; do not automatically change candidate ranking.", Confidence: .68})
	}
	if s.ParserEvents24h >= 20 && s.ParserFailures24h*20 > s.ParserEvents24h {
		out = append(out, Insight{Domain: "quality", Key: "quality.cv_parser_failure_rate", Severity: "high", Title: "CV parser failure rate needs review", Rationale: "Parser exceptions exceed five percent of observed parser events over the last 24 hours.", Evidence: map[string]any{"parser_events_24h": s.ParserEvents24h, "parser_failures_24h": s.ParserFailures24h}, Recommendation: "Review failed document classes and parser/scanner telemetry without exposing CV contents.", Confidence: .88})
	}
	if s.CriticalAlerts > 0 {
		out = append(out, Insight{Domain: "operations", Key: "operations.critical_alerts", Severity: "high", Title: "Critical operational alerts are active", Rationale: "One or more critical alerts remain open or acknowledged.", Evidence: map[string]any{"critical_alerts": s.CriticalAlerts}, Recommendation: "Assign incident ownership and resolve underlying alerts before accepting a production release.", Confidence: .96})
	}
	if s.PendingPrivacyRequests >= 10 {
		out = append(out, Insight{Domain: "privacy", Key: "privacy.request_backlog", Severity: "watch", Title: "Privacy request workload is elevated", Rationale: "The open data-rights queue may require additional reviewer capacity.", Evidence: map[string]any{"pending_privacy_requests": s.PendingPrivacyRequests}, Recommendation: "Review due dates, assigned reviewers, and fulfilment evidence; do not auto-complete requests.", Confidence: .82})
	}
	if s.PendingApprovals >= 10 {
		out = append(out, Insight{Domain: "governance", Key: "governance.approval_backlog", Severity: "watch", Title: "Governed-action approval queue is elevated", Rationale: "A growing dual-approval queue can delay releases and sensitive administrative changes.", Evidence: map[string]any{"pending_approvals": s.PendingApprovals}, Recommendation: "Review ageing approvals and reviewer coverage without bypassing separation of duties.", Confidence: .84})
	}
	if len(out) == 0 {
		out = append(out, Insight{Domain: "operations", Key: "operations.no_material_signal", Severity: "info", Title: "No material rule-based signal detected", Rationale: "Current aggregate signals did not cross the conservative advisory thresholds in this engine version.", Evidence: map[string]any{"engine_version": EngineVersion}, Recommendation: "Continue normal monitoring. Absence of an insight is not proof of production readiness.", Confidence: .65})
	}
	return out
}

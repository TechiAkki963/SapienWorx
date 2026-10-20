package parsing

import "context"

// Statistics uses a retention-bounded operational window. Correction/review
// counts are quality signals, not model-training approvals or accuracy scores.
type Statistics struct {
	Available                bool     `json:"available"`
	WindowHours              int      `json:"window_hours"`
	Operations               int64    `json:"operations"`
	OpenAIOperations         int64    `json:"handled_openai"`
	ProviderAttempts         int64    `json:"openai_requests_total"`
	CacheHits                int64    `json:"handled_cache"`
	HandledDeterministically int64    `json:"handled_deterministically"`
	HandledLocal             int64    `json:"handled_local"`
	Failed                   int64    `json:"failed"`
	HumanReview              int64    `json:"human_review"`
	OwnerReviewed            int64    `json:"owner_reviewed"`
	CorrectedOperations      int64    `json:"corrected_operations"`
	SchemaValid              int64    `json:"schema_valid"`
	DomainValid              int64    `json:"domain_valid"`
	TaxonomyResolved         int64    `json:"taxonomy_resolved"`
	TaxonomyTotal            int64    `json:"taxonomy_total"`
	ReviewedFields           int64    `json:"reviewed_fields"`
	CorrectedFields          int64    `json:"corrected_fields"`
	FieldCorrectionRate      *float64 `json:"field_correction_rate"`
	AvoidanceRate            *float64 `json:"external_ai_avoidance_rate"`
}

func (s SQLStore) Statistics(ctx context.Context) Statistics {
	v := Statistics{WindowHours: 24}
	err := s.DB.QueryRow(ctx, `SELECT count(*),count(*) FILTER(WHERE status IN ('provider_error','validation_error','rejected')),count(*) FILTER(WHERE status='requires_review'),count(*) FILTER(WHERE status='owner_reviewed'),count(*) FILTER(WHERE learning_metadata->>'human_corrected'='true'),count(*) FILTER(WHERE learning_metadata->>'schema_valid'='true'),count(*) FILTER(WHERE learning_metadata->>'domain_valid'='true'),COALESCE(sum((learning_metadata->>'cache_hits')::bigint),0),COALESCE(sum((learning_metadata->>'taxonomy_resolved')::bigint),0),COALESCE(sum((learning_metadata->>'taxonomy_total')::bigint),0) FROM intelligence.ai_parse_operations WHERE created_at>=now()-interval '24 hours' AND expires_at>now()`).Scan(&v.Operations, &v.Failed, &v.HumanReview, &v.OwnerReviewed, &v.CorrectedOperations, &v.SchemaValid, &v.DomainValid, &v.CacheHits, &v.TaxonomyResolved, &v.TaxonomyTotal)
	if err != nil {
		return v
	}
	if s.DB.QueryRow(ctx, `SELECT COALESCE(sum((learning_metadata->>'reviewed_fields')::bigint),0),COALESCE(sum((learning_metadata->>'corrected_fields')::bigint),0) FROM intelligence.ai_parse_operations WHERE created_at>=now()-interval '24 hours' AND expires_at>now()`).Scan(&v.ReviewedFields, &v.CorrectedFields) != nil {
		return v
	}
	if v.ReviewedFields > 0 {
		rate := float64(v.CorrectedFields) / float64(v.ReviewedFields)
		v.FieldCorrectionRate = &rate
	}
	err = s.DB.QueryRow(ctx, `SELECT count(*) FILTER(WHERE attempts>0),COALESCE(sum(attempts),0) FROM intelligence.ai_usage_events WHERE occurred_at>=now()-interval '24 hours' AND task IN ('job.parse','cv.parse','job.generate_description')`).Scan(&v.OpenAIOperations, &v.ProviderAttempts)
	if err != nil {
		return v
	}
	v.Available = true
	denominator := v.OpenAIOperations + v.CacheHits
	if denominator > 0 {
		x := float64(v.CacheHits) / float64(denominator)
		v.AvoidanceRate = &x
	}
	return v
}

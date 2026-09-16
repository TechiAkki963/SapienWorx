package messaging

import "encoding/json"

const EventTypeStageChange EventType = "STAGE_CHANGE"

type StageChangePayload struct {
	ApplicationID string `json:"application_id"`
	CandidateID   string `json:"candidate_id"`
	JobID         string `json:"job_id"`
	Stage         string `json:"stage"`
}

func NewStageChangeEvent(applicationID, candidateID, jobID, stage string) WebSocketEvent {
	payload, _ := json.Marshal(StageChangePayload{
		ApplicationID: applicationID,
		CandidateID:   candidateID,
		JobID:         jobID,
		Stage:         stage,
	})
	return WebSocketEvent{
		Type:     EventTypeStageChange,
		ThreadID: "",
		SenderID: "system",
		Payload:  payload,
	}
}

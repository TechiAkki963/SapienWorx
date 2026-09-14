package messaging

import "time"

type ThreadStatus string

const (
	ThreadStatusOpen   ThreadStatus = "open"
	ThreadStatusClosed ThreadStatus = "closed"
)

type SenderType string

const (
	SenderTypeCandidate SenderType = "candidate"
	SenderTypeRecruiter SenderType = "recruiter"
)

type MessageTemplate struct {
	ID              string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	RecruiterID     string    `gorm:"type:uuid;not null;index:idx_message_templates_recruiter" json:"recruiter_id"`
	Title           string    `gorm:"type:varchar(160);not null" json:"title"`
	SubjectTemplate string    `gorm:"type:varchar(255);not null" json:"subject_template"`
	BodyTemplate    string    `gorm:"type:text;not null" json:"body_template"`
	CreatedAt       time.Time `gorm:"not null;autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time `gorm:"not null;autoUpdateTime" json:"updated_at"`
}

func (MessageTemplate) TableName() string { return "message_templates" }

type ChatThread struct {
	ID          string        `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	RecruiterID string        `gorm:"type:uuid;not null;index:idx_chat_threads_recruiter_updated" json:"recruiter_id"`
	CandidateID string        `gorm:"type:uuid;not null;index:idx_chat_threads_candidate_updated" json:"candidate_id"`
	JobID       *string       `gorm:"type:uuid;index" json:"job_id,omitempty"`
	Subject     string        `gorm:"type:varchar(255);not null" json:"subject"`
	Status      ThreadStatus  `gorm:"type:chat_thread_status;not null;default:'open';index" json:"status"`
	CreatedAt   time.Time     `gorm:"not null;autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time     `gorm:"not null;autoUpdateTime" json:"updated_at"`
	Messages    []ChatMessage `gorm:"foreignKey:ThreadID;constraint:OnDelete:CASCADE" json:"messages,omitempty"`
}

func (ChatThread) TableName() string { return "chat_threads" }

type ChatMessage struct {
	ID         string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ThreadID   string     `gorm:"type:uuid;not null;index:idx_chat_messages_thread_created" json:"thread_id"`
	SenderID   string     `gorm:"type:uuid;not null;index" json:"sender_id"`
	SenderType SenderType `gorm:"type:chat_sender_type;not null" json:"sender_type"`
	Content    string     `gorm:"type:text;not null" json:"content"`
	IsRead     bool       `gorm:"not null;default:false;index" json:"is_read"`
	CreatedAt  time.Time  `gorm:"not null;autoCreateTime" json:"created_at"`
}

func (ChatMessage) TableName() string { return "chat_messages" }

type ThreadSummary struct {
	ID               string       `json:"id"`
	RecruiterID      string       `json:"recruiter_id"`
	CandidateID      string       `json:"candidate_id"`
	JobID            *string      `json:"job_id,omitempty"`
	Subject          string       `json:"subject"`
	Status           ThreadStatus `json:"status"`
	CounterpartyName string       `json:"counterparty_name"`
	JobTitle         *string      `json:"job_title,omitempty"`
	LastMessage      *string      `json:"last_message,omitempty"`
	UnreadCount      int          `json:"unread_count"`
	CreatedAt        time.Time    `json:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at"`
}

type InitiateInput struct {
	CandidateID string `json:"candidate_id"`
	JobID       string `json:"job_id,omitempty"`
	Subject     string `json:"subject"`
	Content     string `json:"content"`
}

type TemplateInput struct {
	Title           string `json:"title"`
	SubjectTemplate string `json:"subject_template"`
	BodyTemplate    string `json:"body_template"`
}

type ThreadWithMessage struct {
	Thread  ChatThread  `json:"thread"`
	Message ChatMessage `json:"message"`
}

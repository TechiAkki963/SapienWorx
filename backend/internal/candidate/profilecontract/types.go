// Package profilecontract owns provider-neutral candidate and resume contracts.
// It performs no extraction, persistence, network requests or automatic promotion.
package profilecontract

import (
	"encoding/json"
	"log/slog"
	"time"
)

const Version = "v1"

// CandidateProfile is an authoritative snapshot. Verification and identity are
// server-owned and intentionally absent from the parser's proposed ProfileData.
type CandidateProfile struct {
	SchemaVersion string              `json:"schema_version"`
	CandidateID   string              `json:"candidate_id"`
	UpdatedAt     *time.Time          `json:"updated_at"`
	Profile       ProfileData         `json:"profile"`
	Verification  ContactVerification `json:"verification"`
	Resumes       []ResumeMetadata    `json:"resumes"`
}

type ContactVerification struct {
	EmailVerified bool `json:"email_verified"`
	PhoneVerified bool `json:"phone_verified"`
}

// ProfileData has ordinary nullable values. Parser provenance/confidence lives
// in a separate JSON-pointer map, not a Field<T> wrapper around every property.
type ProfileData struct {
	Identity          Identity            `json:"identity"`
	Contact           Contact             `json:"contact"`
	Professional      Professional        `json:"professional"`
	Location          LocationPreferences `json:"location"`
	Skills            []Skill             `json:"skills"`
	Employment        []Employment        `json:"employment"`
	Education         []Education         `json:"education"`
	Certifications    []Certification     `json:"certifications"`
	Projects          []Project           `json:"projects"`
	Languages         []Language          `json:"languages"`
	Links             []Link              `json:"links"`
	Availability      Availability        `json:"availability"`
	Compensation      Compensation        `json:"compensation"`
	Preferences       WorkPreferences     `json:"preferences"`
	Classification    Classification      `json:"classification"`
	WorkAuthorization []WorkAuthorization `json:"work_authorization"`
	Publications      []Achievement       `json:"publications"`
	Patents           []Achievement       `json:"patents"`
	Awards            []Achievement       `json:"awards"`
	Honors            []Achievement       `json:"honors"`
}

type Identity struct {
	DisplayName   *string `json:"display_name"`
	FirstName     *string `json:"first_name"`
	MiddleName    *string `json:"middle_name"`
	LastName      *string `json:"last_name"`
	PreferredName *string `json:"preferred_name"`
}

type Contact struct {
	PrimaryEmail   *string `json:"primary_email"`
	AlternateEmail *string `json:"alternate_email"`
	PrimaryPhone   *string `json:"primary_phone"`
	AlternatePhone *string `json:"alternate_phone"`
	CountryCode    *string `json:"country_code"`
}

// EntityRef refers to existing taxonomies; it does not create or guess mappings.
// Namespaces distinguish workforce UUIDs from legacy Intelligence skill UUIDs.
type EntityRef struct {
	ID        *string `json:"id"`
	Namespace *string `json:"namespace" enum:"workforce,intelligence,companies"`
	Name      *string `json:"name"`
	RawValue  *string `json:"raw_value" raw:"true"`
}

type Professional struct {
	Headline                 *string   `json:"headline"`
	Summary                  *string   `json:"summary"`
	CurrentDesignation       EntityRef `json:"current_designation"`
	CurrentCompany           EntityRef `json:"current_company"`
	EmploymentStatus         *string   `json:"employment_status" enum:"employed,unemployed,self_employed,student,fresher,on_career_break"`
	TotalExperienceMonths    *int      `json:"total_experience_months"`
	RelevantExperienceMonths *int      `json:"relevant_experience_months"`
	Seniority                *string   `json:"seniority" enum:"intern,entry,junior,mid,senior,lead,manager,director,executive"`
}

type Location struct {
	ID          *string `json:"id"`
	City        *string `json:"city"`
	State       *string `json:"state"`
	CountryCode *string `json:"country_code"`
	PostalCode  *string `json:"postal_code"`
	RawValue    *string `json:"raw_value" raw:"true"`
}

type LocationPreferences struct {
	Current           *Location  `json:"current"`
	Preferred         []Location `json:"preferred"`
	WillingToRelocate *bool      `json:"willing_to_relocate"`
	RemotePreference  *string    `json:"remote_preference" enum:"onsite,hybrid,remote,flexible"`
}

// PartialDate preserves precision. Missing months/days are never invented.
type PartialDate struct {
	Precision string  `json:"precision" enum:"unknown,year,month,day"`
	Year      *int    `json:"year"`
	Month     *int    `json:"month"`
	Day       *int    `json:"day"`
	RawValue  *string `json:"raw_value" raw:"true"`
}

type Skill struct {
	Entity           EntityRef    `json:"entity"`
	Category         *string      `json:"category"`
	Proficiency      *string      `json:"proficiency"`
	ExperienceMonths *int         `json:"experience_months"`
	LastUsed         *PartialDate `json:"last_used"`
}

type Employment struct {
	ExperienceID     *string      `json:"experience_id" system:"true"`
	Company          EntityRef    `json:"company"`
	Designation      EntityRef    `json:"designation"`
	EmploymentType   *string      `json:"employment_type" enum:"full_time,part_time,contract,internship,temporary"`
	Engagement       *string      `json:"engagement" enum:"employee,freelancer,consultant,contractor"`
	Location         *Location    `json:"location"`
	StartDate        *PartialDate `json:"start_date"`
	EndDate          *PartialDate `json:"end_date"`
	IsCurrent        *bool        `json:"is_current"`
	Description      *string      `json:"description"`
	Responsibilities []string     `json:"responsibilities"`
	Achievements     []string     `json:"achievements"`
	Skills           []Skill      `json:"skills"`
}

type Education struct {
	EducationID    *string      `json:"education_id" system:"true"`
	Institution    EntityRef    `json:"institution"`
	Qualification  EntityRef    `json:"qualification"`
	Degree         *string      `json:"degree"`
	Specialization *string      `json:"specialization"`
	FieldOfStudy   *string      `json:"field_of_study"`
	StartDate      *PartialDate `json:"start_date"`
	EndDate        *PartialDate `json:"end_date"`
	GraduationYear *int         `json:"graduation_year"`
	Grade          *string      `json:"grade"`
	GradeType      *string      `json:"grade_type" enum:"cgpa_10,gpa_4,percentage,letter,class_division,unstructured"`
	Location       *Location    `json:"location"`
}

type Certification struct {
	Entity              EntityRef    `json:"entity"`
	IssuingOrganization *string      `json:"issuing_organization"`
	CredentialID        *string      `json:"credential_id"`
	CredentialURL       *string      `json:"credential_url"`
	IssueDate           *PartialDate `json:"issue_date"`
	ExpiryDate          *PartialDate `json:"expiry_date"`
	DoesNotExpire       *bool        `json:"does_not_expire"`
}

type Project struct {
	ProjectID    *string      `json:"project_id" system:"true"`
	Name         *string      `json:"name"`
	Role         *string      `json:"role"`
	Organization *string      `json:"organization"`
	Description  *string      `json:"description"`
	StartDate    *PartialDate `json:"start_date"`
	EndDate      *PartialDate `json:"end_date"`
	Skills       []Skill      `json:"skills"`
	Technologies []EntityRef  `json:"technologies"`
	URL          *string      `json:"url"`
}

type Language struct {
	Entity      EntityRef `json:"entity"`
	Proficiency *string   `json:"proficiency"`
	Read        *bool     `json:"read"`
	Write       *bool     `json:"write"`
	Speak       *bool     `json:"speak"`
}

type Link struct {
	Type  string  `json:"type" enum:"linkedin,github,portfolio,website,behance,dribbble,stack_overflow,other"`
	Label *string `json:"label"`
	URL   string  `json:"url"`
}

type Availability struct {
	NoticePeriodDays       *int         `json:"notice_period_days"`
	NoticePeriodRaw        *string      `json:"notice_period_raw" raw:"true"`
	AvailableFrom          *PartialDate `json:"available_from"`
	ImmediateJoiner        *bool        `json:"immediate_joiner"`
	CurrentlyServingNotice *bool        `json:"currently_serving_notice"`
}

// Amount is a decimal string, never a binary floating-point currency value.
type Money struct {
	Amount   *string `json:"amount"`
	Currency *string `json:"currency"`
	Period   *string `json:"period" enum:"annual,monthly,hourly,daily"`
	RawValue *string `json:"raw_value" raw:"true"`
}

type Compensation struct {
	Current  *Money `json:"current"`
	Expected *Money `json:"expected"`
}

type WorkPreferences struct {
	EmploymentTypes []string    `json:"employment_types" enum:"full_time,part_time,contract,internship,temporary"`
	WorkModes       []string    `json:"work_modes" enum:"onsite,hybrid,remote"`
	WillingToTravel *bool       `json:"willing_to_travel"`
	Industries      []EntityRef `json:"industries"`
	Functions       []EntityRef `json:"functions"`
}

type Classification struct {
	Industries []EntityRef `json:"industries"`
	Functions  []EntityRef `json:"functions"`
	Roles      []EntityRef `json:"roles"`
	Domains    []EntityRef `json:"domains"`
}

type WorkAuthorization struct {
	CountryCode *string      `json:"country_code"`
	Status      *string      `json:"status" enum:"authorized,requires_sponsorship,permit_holder"`
	Permit      *string      `json:"permit"`
	ExpiresAt   *PartialDate `json:"expires_at"`
	RawValue    *string      `json:"raw_value" raw:"true"`
}

type Achievement struct {
	Title        *string      `json:"title"`
	Organization *string      `json:"organization"`
	Description  *string      `json:"description"`
	Date         *PartialDate `json:"date"`
	URL          *string      `json:"url"`
}

type ResumeMetadata struct {
	ResumeID         string     `json:"resume_id"`
	OriginalFilename *string    `json:"original_filename"`
	MIMEType         *string    `json:"mime_type"`
	FileSize         *int64     `json:"file_size"`
	UploadedAt       *time.Time `json:"uploaded_at"`
	Purpose          *string    `json:"purpose" enum:"primary,historical,role_specific"`
	PageCount        *int       `json:"page_count"`
}

type ParserResult struct {
	ContractVersion        string                   `json:"contract_version"`
	ProfileSchemaVersion   string                   `json:"profile_schema_version"`
	ResultID               string                   `json:"result_id"`
	CandidateID            string                   `json:"candidate_id"`
	Resume                 ResumeMetadata           `json:"resume"`
	ParserProvider         string                   `json:"parser_provider"`
	ParserVersion          string                   `json:"parser_version"`
	SourceType             string                   `json:"source_type" enum:"resume"`
	Status                 ParseStatus              `json:"status"`
	Profile                ProfileData              `json:"profile"`
	ParserGeneratedSummary *string                  `json:"parser_generated_summary"`
	FieldMetadata          map[string]FieldMetadata `json:"field_metadata"`
	Issues                 []Issue                  `json:"issues"`
	CreatedAt              time.Time                `json:"created_at"`
}

type Provenance struct {
	Source    string `json:"source" enum:"resume,candidate_input,recruiter_input,profile_import,external_integration,ai_derived,system_derived"`
	Kind      string `json:"kind" enum:"explicit,normalized,derived,inferred,manual"`
	Section   string `json:"section"`
	Reference string `json:"reference"`
	Page      *int   `json:"page"`
}

type FieldMetadata struct {
	Provenance Provenance      `json:"provenance"`
	Confidence *float64        `json:"confidence"`
	Review     ReviewStatus    `json:"review_status"`
	RawValue   json.RawMessage `json:"raw_value" raw:"true"`
}

type Issue struct {
	Severity string `json:"severity" enum:"error,warning,info"`
	Code     string `json:"code"`
	Path     string `json:"path"`
}

type ValidationReport struct {
	Issues []Issue `json:"issues"`
}

func (r ValidationReport) HasErrors() bool {
	for _, issue := range r.Issues {
		if issue.Severity == "error" {
			return true
		}
	}
	return false
}

// Diagnostic formatting intentionally withholds personal and compensation data.
func (CandidateProfile) String() string         { return "CandidateProfile [private values withheld]" }
func (p CandidateProfile) GoString() string     { return p.String() }
func (p CandidateProfile) LogValue() slog.Value { return slog.StringValue(p.String()) }
func (ProfileData) String() string              { return "ProfileData [private values withheld]" }
func (p ProfileData) GoString() string          { return p.String() }
func (p ProfileData) LogValue() slog.Value      { return slog.StringValue(p.String()) }
func (ParserResult) String() string             { return "ParserResult [private values withheld]" }
func (p ParserResult) GoString() string         { return p.String() }
func (p ParserResult) LogValue() slog.Value     { return slog.StringValue(p.String()) }

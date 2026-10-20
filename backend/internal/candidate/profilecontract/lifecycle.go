package profilecontract

import "errors"

type ParseStatus string

const (
	Uploaded         ParseStatus = "uploaded"
	Validating       ParseStatus = "validating"
	Extracting       ParseStatus = "extracting"
	Parsing          ParseStatus = "parsing"
	ValidatingResult ParseStatus = "validating_result"
	ReadyForReview   ParseStatus = "ready_for_review"
	Confirmed        ParseStatus = "confirmed"
	FileRejected     ParseStatus = "file_rejected"
	ExtractionFailed ParseStatus = "extraction_failed"
	ParsingFailed    ParseStatus = "parsing_failed"
	ValidationFailed ParseStatus = "validation_failed"
)

type ReviewStatus string

const (
	Unreviewed      ReviewStatus = "unreviewed"
	ReviewConfirmed ReviewStatus = "confirmed"
	Edited          ReviewStatus = "edited"
	Rejected        ReviewStatus = "rejected"
)

var ErrInvalidContract = errors.New("invalid profile contract")
var ErrForbidden = errors.New("profile review forbidden")
var ErrConflict = errors.New("profile review revision conflict")

var transitions = map[ParseStatus][]ParseStatus{
	Uploaded: {Validating}, Validating: {Extracting, FileRejected},
	Extracting: {Parsing, ExtractionFailed}, Parsing: {ValidatingResult, ParsingFailed},
	ValidatingResult: {ReadyForReview, ValidationFailed}, ReadyForReview: {Confirmed},
}

// Lifecycle belongs to one resume parse attempt. A retry creates another result
// ID; terminal failures and confirmed results are not silently rewritten.
func CanTransition(from, to ParseStatus) bool {
	for _, allowed := range transitions[from] {
		if allowed == to {
			return true
		}
	}
	return false
}

func validParseStatus(s ParseStatus) bool {
	for _, v := range []ParseStatus{Uploaded, Validating, Extracting, Parsing, ValidatingResult, ReadyForReview, Confirmed, FileRejected, ExtractionFailed, ParsingFailed, ValidationFailed} {
		if s == v {
			return true
		}
	}
	return false
}

// ConfidenceBand is presentation policy, not a hiring/ranking score.
func ConfidenceBand(value *float64, high, medium float64) (string, error) {
	if !(high >= medium && medium >= 0 && high <= 1) {
		return "", ErrInvalidContract
	}
	if value == nil {
		return "unknown", nil
	}
	if !(*value >= 0 && *value <= 1) {
		return "", ErrInvalidContract
	}
	if *value >= high {
		return "high", nil
	}
	if *value >= medium {
		return "medium", nil
	}
	return "low", nil
}

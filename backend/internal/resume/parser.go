// Package resume provides a conservative, local CV parsing preview. It does not
// persist the source document or update a candidate profile.
package resume

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/xml"
	"errors"
	"io"
	"net/mail"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	pdf "github.com/giraffesyo/pdf"
)

const MaxFileBytes = 1500 << 10 // the current HTTP request limit is 2 MiB
const maxDocumentText = 100_000

var (
	ErrUnsupported = errors.New("upload a text-based PDF or DOCX")
	ErrTooLarge    = errors.New("CV preview must be smaller than 1.5 MB")
	ErrUnreadable  = errors.New("could not read usable text; use a text-based PDF or DOCX")
	emailPattern   = regexp.MustCompile(`(?i)\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b`)
	phonePattern   = regexp.MustCompile(`(?:\+91[\s-]?)?[6-9][0-9]{4}[\s-]?[0-9]{5}\b`)
	urlPattern     = regexp.MustCompile(`(?i)\b(?:https?://)?(?:www\.)?(?:linkedin\.com/in/|github\.com/)[^\s,;]+`)
	datePattern    = regexp.MustCompile(`(?i)\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(20[0-3][0-9]|19[89][0-9])\s*[-–—]\s*((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(?:20[0-3][0-9]|19[89][0-9])|present|current)\b`)
)

type Field struct {
	Value          string `json:"value"`
	Confidence     string `json:"confidence"` // heuristic labels, not calibrated probabilities
	Evidence       string `json:"evidence"`
	RequiresReview bool   `json:"requires_review"`
}

type Employment struct {
	Role     string `json:"role"`
	Company  string `json:"company"`
	Start    string `json:"start"`
	End      string `json:"end"`
	Evidence string `json:"evidence"`
}

type Education struct {
	Degree      string `json:"degree"`
	Institution string `json:"institution"`
	Year        string `json:"year"`
	Evidence    string `json:"evidence"`
}

type Preview struct {
	Format     string           `json:"format"`
	Fields     map[string]Field `json:"fields"`
	Skills     []Field          `json:"skills"`
	Employment []Employment     `json:"employment"`
	Education  []Education      `json:"education"`
	Links      []string         `json:"links"`
	Warnings   []string         `json:"warnings"`
}

func Parse(ctx context.Context, filename string, data []byte) (Preview, error) {
	return ParseWithOCR(ctx, filename, data, nil)
}

// OCRFunc is invoked only for an image-only PDF, after the caller has scanned
// the document. It must apply its own page, memory, and time limits.
type OCRFunc func(context.Context, []byte, int) (string, error)

func ParseWithOCR(ctx context.Context, filename string, data []byte, ocr OCRFunc) (Preview, error) {
	if len(data) == 0 || len(data) > MaxFileBytes {
		return Preview{}, ErrTooLarge
	}
	name := strings.ToLower(strings.TrimSpace(filename))
	var format, text string
	var err error
	usedOCR := false
	switch {
	case strings.HasSuffix(name, ".pdf") && bytes.HasPrefix(data, []byte("%PDF-")):
		format = "PDF"
		var pages int
		text, pages, err = extractPDF(ctx, data)
		if err == nil && len(strings.TrimSpace(text)) < 30 && ocr != nil {
			text, err = ocr(ctx, data, pages)
			usedOCR = err == nil
		}
	case strings.HasSuffix(name, ".docx") && bytes.HasPrefix(data, []byte("PK\x03\x04")):
		format = "DOCX"
		text, err = extractDOCX(data)
	default:
		return Preview{}, ErrUnsupported
	}
	if err != nil {
		return Preview{}, err
	}
	if len(strings.TrimSpace(text)) < 30 {
		return Preview{}, ErrUnreadable
	}
	if len(text) > maxDocumentText {
		return Preview{}, ErrTooLarge
	}
	result := understand(text, time.Now())
	result.Format = format
	if usedOCR {
		result.Format = "PDF (OCR)"
		result.Warnings = append(result.Warnings, "Scanned text was recognized with OCR; verify every suggested detail.")
	}
	return result, nil
}

func extractPDF(ctx context.Context, data []byte) (string, int, error) {
	doc, err := pdf.Extract(ctx, bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", 0, ErrUnreadable
	}
	if len(doc.Pages) == 0 || len(doc.Pages) > 8 {
		return "", 0, ErrTooLarge
	}
	return doc.Text(), len(doc.Pages), nil
}

func extractDOCX(data []byte) (string, error) {
	z, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil || len(z.File) > 100 {
		return "", ErrUnreadable
	}
	var body *zip.File
	var total uint64
	for _, f := range z.File {
		lower := strings.ToLower(f.Name)
		if strings.Contains(lower, "vbaproject") || strings.Contains(lower, "embeddings/") {
			return "", ErrUnsupported
		}
		if f.UncompressedSize64 > 5<<20 {
			return "", ErrTooLarge
		}
		total += f.UncompressedSize64
		if total > 12<<20 {
			return "", ErrTooLarge
		}
		if f.Name == "word/document.xml" {
			body = f
		}
	}
	if body == nil || body.UncompressedSize64 > 2<<20 {
		return "", ErrUnreadable
	}
	r, err := body.Open()
	if err != nil {
		return "", ErrUnreadable
	}
	defer r.Close()
	decoder := xml.NewDecoder(io.LimitReader(r, 2<<20))
	var out strings.Builder
	var paragraph strings.Builder
	insideText := false
	for {
		token, tokenErr := decoder.Token()
		if errors.Is(tokenErr, io.EOF) {
			break
		}
		if tokenErr != nil {
			return "", ErrUnreadable
		}
		switch item := token.(type) {
		case xml.StartElement:
			if item.Name.Local == "t" {
				insideText = true
			}
			if item.Name.Local == "tab" {
				paragraph.WriteByte(' ')
			}
			if item.Name.Local == "br" {
				paragraph.WriteByte('\n')
			}
		case xml.EndElement:
			if item.Name.Local == "t" {
				insideText = false
			}
			if item.Name.Local == "p" {
				line := strings.TrimSpace(paragraph.String())
				if line != "" {
					out.WriteString(line)
					out.WriteByte('\n')
				}
				paragraph.Reset()
			}
		case xml.CharData:
			if insideText {
				paragraph.Write(item)
			}
		}
		if out.Len()+paragraph.Len() > maxDocumentText {
			return "", ErrTooLarge
		}
	}
	return out.String(), nil
}

func understand(raw string, now time.Time) Preview {
	result := Preview{Fields: map[string]Field{}, Skills: []Field{}, Employment: []Employment{}, Education: []Education{}, Links: []string{}, Warnings: []string{}}
	lines := make([]string, 0)
	for _, original := range strings.Split(strings.ReplaceAll(raw, "\r", ""), "\n") {
		line := strings.Join(strings.Fields(original), " ")
		if line != "" {
			lines = append(lines, line)
		}
	}
	if len(lines) == 0 {
		return result
	}
	field := func(key, value, evidence, confidence string) {
		if value != "" && result.Fields[key].Value == "" {
			result.Fields[key] = Field{Value: value, Evidence: short(evidence), Confidence: confidence, RequiresReview: true}
		}
	}
	for i, line := range lines {
		if i >= 6 {
			break
		}
		if plausibleName(line) {
			field("full_name", line, line, "review")
			break
		}
	}
	section := "header"
	sectionLines := map[string][]string{}
	for i, line := range lines {
		if next := sectionName(line); next != "" {
			section = next
			continue
		}
		sectionLines[section] = append(sectionLines[section], line)
		if match := emailPattern.FindString(line); match != "" {
			if _, err := mail.ParseAddress(match); err == nil {
				field("email", strings.ToLower(match), line, "high")
			}
		}
		if match := phonePattern.FindString(line); match != "" {
			field("phone", strings.Join(strings.Fields(match), ""), line, "review")
		}
		for _, link := range urlPattern.FindAllString(line, -1) {
			link = strings.TrimRight(link, ".,;)")
			if !strings.HasPrefix(link, "http") {
				link = "https://" + link
			}
			if !contains(result.Links, link) {
				result.Links = append(result.Links, link)
			}
		}
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "location:") || strings.HasPrefix(lower, "current location:") || strings.HasPrefix(lower, "city:") {
			city, state := parseLocation(line[strings.IndexByte(line, ':')+1:])
			field("current_city", city, line, "review")
			field("current_state", state, line, "review")
		}
		if i < 5 && section == "header" && result.Fields["headline"].Value == "" && !plausibleName(line) && !strings.ContainsAny(line, "@0123456789") && !strings.Contains(lower, "resume") && len(line) < 90 {
			field("headline", line, line, "review")
		}
	}
	if summary := sectionLines["summary"]; len(summary) > 0 {
		field("professional_summary", short(strings.Join(summary, " ")), summary[0], "review")
	}
	result.Skills = findSkills(sectionLines["skills"])
	result.Employment = findEmployment(sectionLines["employment"])
	result.Education = findEducation(sectionLines["education"])
	var ongoing []Employment
	for _, item := range result.Employment {
		if strings.EqualFold(item.End, "present") || strings.EqualFold(item.End, "current") {
			ongoing = append(ongoing, item)
		}
	}
	if len(ongoing) == 1 {
		field("current_designation", ongoing[0].Role, ongoing[0].Evidence, "review")
		field("current_company", ongoing[0].Company, ongoing[0].Evidence, "review")
	} else if len(ongoing) > 1 {
		result.Warnings = append(result.Warnings, "Multiple current roles were found; confirm your current employer and designation manually.")
	}
	if months := unionMonths(result.Employment, now); months > 0 {
		field("total_experience_months", strconv.Itoa(months), "Supported employment date ranges", "review")
	}
	if len(result.Employment) == 0 {
		result.Warnings = append(result.Warnings, "Work history needs manual review.")
	}
	if len(result.Education) == 0 {
		result.Warnings = append(result.Warnings, "Education needs manual review.")
	}
	return result
}

func short(value string) string {
	value = strings.TrimSpace(value)
	if len(value) > 500 {
		for size := 500; size > 0; size-- {
			if utf8.ValidString(value[:size]) {
				return value[:size]
			}
		}
	}
	return value
}

func parseLocation(raw string) (city, state string) {
	raw = strings.TrimSpace(strings.SplitN(raw, "(", 2)[0])
	parts := strings.Split(raw, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	if len(parts) == 1 && parts[0] != "" && !isIndianState(parts[0]) {
		return parts[0], ""
	}
	if len(parts) >= 3 {
		return parts[0], parts[1]
	}
	if len(parts) == 2 && strings.EqualFold(parts[1], "India") {
		if isIndianState(parts[0]) {
			return "", parts[0]
		}
		return parts[0], ""
	}
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return "", ""
}

func isIndianState(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "maharashtra", "karnataka", "tamil nadu", "telangana", "gujarat", "delhi", "west bengal", "kerala", "rajasthan", "uttar pradesh", "madhya pradesh", "andhra pradesh", "punjab", "haryana", "bihar", "odisha", "goa", "assam", "chhattisgarh":
		return true
	}
	return false
}

func plausibleName(value string) bool {
	parts := strings.Fields(value)
	if len(parts) < 2 || len(parts) > 4 || len(value) > 60 {
		return false
	}
	for _, part := range parts {
		for _, r := range part {
			if !unicode.IsLetter(r) && r != '-' && r != '.' {
				return false
			}
		}
	}
	for _, word := range []string{"resume", "curriculum", "developer", "engineer", "manager", "profile", "university"} {
		if strings.Contains(strings.ToLower(value), word) {
			return false
		}
	}
	return true
}

func sectionName(value string) string {
	key := strings.ToLower(strings.Trim(strings.TrimSpace(value), ": -•\t"))
	switch key {
	case "summary", "professional summary", "objective", "profile summary", "career summary", "about me":
		return "summary"
	case "experience", "work experience", "professional experience", "employment history", "career history", "work history", "professional background":
		return "employment"
	case "education", "academic qualifications", "academics", "educational qualifications", "academic background":
		return "education"
	case "skills", "technical skills", "core skills", "key skills", "core competencies", "technical expertise", "professional skills", "skills & tools", "skill set":
		return "skills"
	case "projects", "certifications", "languages", "references", "achievements", "awards", "personal details":
		return key
	}
	return ""
}

var skillAliases = map[string]string{
	"golang": "Go", "go lang": "Go", "postgresql": "PostgreSQL", "postgres": "PostgreSQL", "javascript": "JavaScript", "js": "JavaScript", "typescript": "TypeScript", "react.js": "React", "react": "React", "python": "Python", "docker": "Docker", "aws": "AWS", "amazon web services": "AWS", "sql": "SQL", "java": "Java", "figma": "Figma", "user research": "User Research", "product design": "Product Design", "kubernetes": "Kubernetes", "next.js": "Next.js", "talent acquisition": "Talent Acquisition", "technical recruitment": "Technical Recruitment", "technical recruiting": "Technical Recruitment", "candidate sourcing": "Candidate Sourcing", "boolean search": "Boolean Search", "stakeholder management": "Stakeholder Management", "applicant tracking system": "ATS", "ats": "ATS",
}

func findSkills(lines []string) []Field {
	result := make([]Field, 0)
	seen := map[string]bool{}
	for _, line := range lines {
		lower := strings.ToLower(line)
		aliases := make([]string, 0, len(skillAliases))
		for alias := range skillAliases {
			aliases = append(aliases, alias)
		}
		sort.Slice(aliases, func(i, j int) bool { return len(aliases[i]) > len(aliases[j]) })
		for _, alias := range aliases {
			canonical := skillAliases[alias]
			if seen[canonical] {
				continue
			}
			pattern := regexp.MustCompile(`(?i)(?:^|[^\pL\pN])` + regexp.QuoteMeta(alias) + `(?:$|[^\pL\pN])`)
			if pattern.MatchString(lower) {
				seen[canonical] = true
				result = append(result, Field{Value: canonical, Evidence: short(line), Confidence: "review", RequiresReview: true})
			}
		}
		// The English verb "go" is too ambiguous; accept it only as a whole token in a skills list.
		if !seen["Go"] && regexp.MustCompile(`(?i)(?:^|[,;|\s])go(?:$|[,;|\s])`).MatchString(lower) && !strings.Contains(lower, "go to") {
			seen["Go"] = true
			result = append(result, Field{Value: "Go", Evidence: short(line), Confidence: "review", RequiresReview: true})
		}
	}
	return result
}

func findEmployment(lines []string) []Employment {
	items := make([]Employment, 0)
	for index, line := range lines {
		parts := strings.Split(line, "|")
		if len(parts) == 3 {
			start, end, ok := dateRange(parts[2])
			if ok {
				items = append(items, Employment{Role: strings.TrimSpace(parts[0]), Company: strings.TrimSpace(parts[1]), Start: start, End: end, Evidence: short(line)})
			}
			continue
		}
		start, end, ok := dateRange(line)
		if !ok {
			continue
		}
		before := strings.TrimSpace(strings.TrimSuffix(line, datePattern.FindString(line)))
		before = strings.Trim(before, " -–—,:")
		if role, company, found := strings.Cut(before, " at "); found && looksLikeRole(role) && company != "" {
			items = append(items, Employment{Role: strings.TrimSpace(role), Company: strings.TrimSpace(company), Start: start, End: end, Evidence: short(line)})
			continue
		}
		if index < 2 || before != "" {
			continue
		}
		first, second := strings.TrimSpace(lines[index-2]), strings.TrimSpace(lines[index-1])
		if len(first) > 100 || len(second) > 100 || first == "" || second == "" {
			continue
		}
		role, company := first, second
		if !looksLikeRole(role) && looksLikeRole(second) {
			role, company = second, first
		}
		if !looksLikeRole(role) || looksLikeRole(company) {
			continue
		}
		items = append(items, Employment{Role: role, Company: company, Start: start, End: end, Evidence: short(strings.Join(lines[index-2:index+1], " | "))})
	}
	return items
}

func dateRange(value string) (start, end string, ok bool) {
	parts := datePattern.FindStringSubmatch(value)
	if len(parts) != 4 {
		return "", "", false
	}
	return strings.TrimSpace(parts[1] + parts[2]), strings.TrimSpace(parts[3]), true
}

func looksLikeRole(value string) bool {
	lower := strings.ToLower(value)
	for _, word := range []string{"engineer", "developer", "designer", "recruiter", "executive", "manager", "analyst", "consultant", "architect", "specialist", "lead", "director", "intern", "coordinator"} {
		if strings.Contains(lower, word) {
			return true
		}
	}
	return false
}

func findEducation(lines []string) []Education {
	items := make([]Education, 0)
	for index, line := range lines {
		parts := strings.Split(line, "|")
		if len(parts) == 3 && len(strings.TrimSpace(parts[2])) == 4 {
			if _, err := strconv.Atoi(strings.TrimSpace(parts[2])); err == nil {
				items = append(items, Education{Degree: strings.TrimSpace(parts[0]), Institution: strings.TrimSpace(parts[1]), Year: strings.TrimSpace(parts[2]), Evidence: short(line)})
			}
			continue
		}
		if index < 2 || !regexp.MustCompile(`^(?:19|20)\d{2}$`).MatchString(strings.TrimSpace(line)) {
			continue
		}
		degree, institution := strings.TrimSpace(lines[index-2]), strings.TrimSpace(lines[index-1])
		if degree == "" || institution == "" || len(degree) > 100 || len(institution) > 100 {
			continue
		}
		items = append(items, Education{Degree: degree, Institution: institution, Year: strings.TrimSpace(line), Evidence: short(strings.Join(lines[index-2:index+1], " | "))})
	}
	return items
}

func unionMonths(items []Employment, now time.Time) int {
	months := map[int]bool{}
	for _, item := range items {
		if strings.Contains(strings.ToLower(item.Role), "intern") {
			continue
		}
		start, ok := monthYear(item.Start, now)
		if !ok {
			continue
		}
		end, ok := monthYear(item.End, now)
		if !ok || end.Before(start) {
			continue
		}
		for cursor := start; !cursor.After(end) && len(months) < 600; cursor = cursor.AddDate(0, 1, 0) {
			months[cursor.Year()*12+int(cursor.Month())] = true
		}
	}
	return len(months)
}

func monthYear(raw string, now time.Time) (time.Time, bool) {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "present" || raw == "current" {
		return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC), true
	}
	for _, layout := range []string{"Jan 2006", "January 2006", "2006"} {
		if value, err := time.Parse(layout, strings.Title(raw)); err == nil {
			return value, true
		}
	}
	return time.Time{}, false
}

func contains(items []string, value string) bool {
	for _, item := range items {
		if item == value {
			return true
		}
	}
	return false
}

package resume

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"strings"
	"testing"
	"time"
)

const dummyCV = `Akshay Parab
Senior Software Engineer
akshay@example.test
+91 9876543210
Location: Mumbai
linkedin.com/in/akshay-parab
Professional Summary
Backend engineer building reliable hiring tools.
Technical Skills
Golang, Postgres, Docker, AWS, JavaScript
Work Experience
Software Engineer | ABC Technologies | Jan 2020 - Dec 2022
Senior Engineer | XYZ Labs | Jul 2022 - Present
Education
B.E. Computer Science | Mumbai University | 2018
`

func testDOCX(t *testing.T, text string, extra string) []byte {
	t.Helper()
	var output bytes.Buffer
	z := zip.NewWriter(&output)
	entries := map[string]string{"[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`}
	var paragraphs strings.Builder
	for _, line := range strings.Split(text, "\n") {
		if line == "" {
			continue
		}
		paragraphs.WriteString("<w:p><w:r><w:t>")
		paragraphs.WriteString(line)
		paragraphs.WriteString("</w:t></w:r></w:p>")
	}
	entries["word/document.xml"] = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` + paragraphs.String() + `</w:body></w:document>`
	if extra != "" {
		entries[extra] = "unsafe"
	}
	for name, content := range entries {
		entry, err := z.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := z.Close(); err != nil {
		t.Fatal(err)
	}
	return output.Bytes()
}

func TestParseDOCXPreviewDoesNotInventPreferences(t *testing.T) {
	preview, err := Parse(context.Background(), "dummy.docx", testDOCX(t, dummyCV, ""))
	if err != nil {
		t.Fatal(err)
	}
	if preview.Format != "DOCX" {
		t.Fatalf("format = %q", preview.Format)
	}
	for key, want := range map[string]string{"full_name": "Akshay Parab", "email": "akshay@example.test", "current_city": "Mumbai", "headline": "Senior Software Engineer", "total_experience_months": "81"} {
		if key == "total_experience_months" {
			continue
		} // date-dependent value tested below
		if got := preview.Fields[key].Value; got != want {
			t.Errorf("%s = %q, want %q", key, got, want)
		}
	}
	if preview.Fields["notice_period_days"].Value != "" || preview.Fields["expected_salary"].Value != "" {
		t.Fatal("invented candidate preferences")
	}
	if len(preview.Employment) != 2 || len(preview.Education) != 1 {
		t.Fatalf("records: %+v %+v", preview.Employment, preview.Education)
	}
	if len(preview.Skills) != 5 {
		t.Fatalf("skills: %+v", preview.Skills)
	}
	if preview.Fields["total_experience_months"].Value == "" {
		t.Fatal("missing supported experience calculation")
	}
}

func TestExperienceUnionExcludesOverlapAndInternship(t *testing.T) {
	items := []Employment{
		{Role: "Engineer", Start: "Jan 2020", End: "Dec 2022"},
		{Role: "Senior Engineer", Start: "Jul 2022", End: "Dec 2023"},
		{Role: "Intern", Start: "Jan 2019", End: "Dec 2019"},
	}
	if got := unionMonths(items, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)); got != 48 {
		t.Fatalf("months = %d, want 48", got)
	}
}

func TestRejectsDisguisedAndMacroFiles(t *testing.T) {
	if _, err := Parse(context.Background(), "resume.pdf", testDOCX(t, dummyCV, "")); err != ErrUnsupported {
		t.Fatalf("disguised file error = %v", err)
	}
	if _, err := Parse(context.Background(), "resume.docx", testDOCX(t, dummyCV, "word/vbaProject.bin")); err != ErrUnsupported {
		t.Fatalf("macro file error = %v", err)
	}
	if _, err := Parse(context.Background(), "resume.docx", bytes.Repeat([]byte("x"), MaxFileBytes+1)); err != ErrTooLarge {
		t.Fatalf("large file error = %v", err)
	}
}

func TestGoNotInOrdinaryProse(t *testing.T) {
	preview := understand("Mira Shah\nSoftware Engineer\nProfessional Summary\nI go to the office. I use JavaScript.\nSkills\nJavaScript, React", time.Now())
	for _, skill := range preview.Skills {
		if skill.Value == "Go" || skill.Value == "Java" {
			t.Fatalf("false positive skill: %s", skill.Value)
		}
	}
}

func TestCommonMultilineCVAndConservativeLocation(t *testing.T) {
	text := `Aarav Example
Technical Recruiter
aarav@example.test
Location: Maharashtra, India (Open to Navi Mumbai)
Professional Summary
Recruiter focused on thoughtful candidate experiences.
Core Competencies
Talent Acquisition, Candidate Sourcing, Boolean Search, ATS
Professional Experience
Technical Recruiter
Example Technologies
Jan 2021 - Dec 2023
Recruitment Manager
Northstar Labs
Jan 2024 - Present
Education
Bachelor of Business Administration
Mumbai University
2019
`
	preview := understand(text, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC))
	if preview.Fields["current_city"].Value != "" || preview.Fields["current_state"].Value != "Maharashtra" {
		t.Fatalf("location should not invent a city: %+v", preview.Fields)
	}
	if got := preview.Fields["professional_summary"].Value; got != "Recruiter focused on thoughtful candidate experiences." {
		t.Fatalf("summary swallowed later section: %q", got)
	}
	if len(preview.Skills) != 4 || len(preview.Employment) != 2 || len(preview.Education) != 1 {
		t.Fatalf("missed common records: skills=%+v work=%+v education=%+v", preview.Skills, preview.Employment, preview.Education)
	}
	if preview.Fields["total_experience_months"].Value != "69" {
		t.Fatalf("unexpected experience: %+v", preview.Fields["total_experience_months"])
	}
	if preview.Fields["current_company"].Value != "Northstar Labs" || preview.Fields["current_designation"].Value != "Recruitment Manager" {
		t.Fatalf("current role not identified from ongoing work: %+v", preview.Fields)
	}
}

func TestCurrentEmployerUsesOngoingRoleNotPreviousEmployer(t *testing.T) {
	preview := understand("Mira Shah\nSoftware Engineer\nExperience\nSoftware Engineer | TCS | Jan 2020 - Dec 2023\nSenior Software Engineer | Infosys | Jan 2024 - Present\n", time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC))
	if preview.Fields["current_company"].Value != "Infosys" || preview.Fields["current_designation"].Value != "Senior Software Engineer" {
		t.Fatalf("selected previous employer instead of current: %+v", preview.Fields)
	}
}

// These are synthetic layouts, not a measured real-world accuracy sample. They
// guard common formatting variations and explicit non-inference boundaries.
func TestSyntheticLayoutCorpus(t *testing.T) {
	fixtures := []struct {
		name, text, city, skill, role, company, degree string
		work, education                                int
	}{
		{
			name: "designer single-line role",
			text: `Nisha Kapoor
Product Designer
Location: Pune, Maharashtra
Summary
Designs accessible products.
Skills
Figma, User Research, Product Design
Experience
Product Designer at Human Labs Jan 2023 - Present
Education
Bachelor of Design
Design Institute
2022`,
			city: "Pune", skill: "Figma", role: "Product Designer", company: "Human Labs", degree: "Bachelor of Design", work: 1, education: 1,
		},
		{
			name: "engineer multiline role",
			text: `Dev Mehta
Backend Engineer
Location: Bengaluru, Karnataka
Professional Summary
Builds dependable APIs.
Technical Skills
Java, PostgreSQL, Docker
Work History
Backend Engineer
Example Cloud
Feb 2021 - Aug 2024
Education
B.Tech Computer Science | Example University | 2020`,
			city: "Bengaluru", skill: "PostgreSQL", role: "Backend Engineer", company: "Example Cloud", degree: "B.Tech Computer Science", work: 1, education: 1,
		},
		{
			name: "new graduate without invented work",
			text: `Riya Sen
Software Developer
Location: Kolkata, West Bengal
About Me
Seeking a first full-time role.
Skills
Python, React
Education
B.Sc Computer Science
Example College
2026`,
			city: "Kolkata", skill: "Python", degree: "B.Sc Computer Science", work: 0, education: 1,
		},
	}
	for _, fixture := range fixtures {
		t.Run(fixture.name, func(t *testing.T) {
			preview := understand(fixture.text, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC))
			if got := preview.Fields["current_city"].Value; got != fixture.city {
				t.Errorf("city = %q, want %q", got, fixture.city)
			}
			if len(preview.Employment) != fixture.work || len(preview.Education) != fixture.education {
				t.Errorf("records: work=%+v education=%+v", preview.Employment, preview.Education)
			}
			if fixture.work > 0 && (preview.Employment[0].Role != fixture.role || preview.Employment[0].Company != fixture.company) {
				t.Errorf("work = %+v", preview.Employment[0])
			}
			if fixture.education > 0 && preview.Education[0].Degree != fixture.degree {
				t.Errorf("education = %+v", preview.Education[0])
			}
			foundSkill := false
			for _, skill := range preview.Skills {
				foundSkill = foundSkill || skill.Value == fixture.skill
			}
			if !foundSkill {
				t.Errorf("missing %q in skills: %+v", fixture.skill, preview.Skills)
			}
			if fixture.work == 0 && preview.Fields["total_experience_months"].Value != "" {
				t.Error("invented work experience for a new graduate")
			}
		})
	}
}

func TestSummaryTruncatesAtRuneBoundary(t *testing.T) {
	value := strings.Repeat("a", 499) + "é" + "tail"
	if got := short(value); len(got) != 499 {
		t.Fatalf("invalid truncated text: %q", got)
	}
}

func makePDF(stream string) []byte {
	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
		fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(stream), stream),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	}
	var b bytes.Buffer
	b.WriteString("%PDF-1.4\n")
	offsets := []int{0}
	for index, object := range objects {
		offsets = append(offsets, b.Len())
		fmt.Fprintf(&b, "%d 0 obj\n%s\nendobj\n", index+1, object)
	}
	xref := b.Len()
	fmt.Fprintf(&b, "xref\n0 %d\n0000000000 65535 f \n", len(offsets))
	for _, offset := range offsets[1:] {
		fmt.Fprintf(&b, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&b, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(offsets), xref)
	return b.Bytes()
}

func TestParseTextPDF(t *testing.T) {
	stream := "BT /F1 12 Tf 50 750 Td (Aarav Example) Tj 0 -18 Td (Software Engineer) Tj 0 -18 Td (aarav@example.test) Tj ET"
	preview, err := Parse(context.Background(), "dummy.pdf", makePDF(stream))
	if err != nil {
		t.Fatal(err)
	}
	if preview.Format != "PDF" || preview.Fields["email"].Value != "aarav@example.test" {
		t.Fatalf("PDF preview: %+v", preview)
	}
}

func TestImageOnlyPDFUsesOptionalOCR(t *testing.T) {
	imageOnly := makePDF("")
	if _, err := Parse(context.Background(), "scan.pdf", imageOnly); err != ErrUnreadable {
		t.Fatalf("image-only PDF without OCR = %v", err)
	}
	called := false
	preview, err := ParseWithOCR(context.Background(), "scan.pdf", imageOnly, func(_ context.Context, _ []byte, pages int) (string, error) {
		called = true
		if pages != 1 {
			t.Fatalf("OCR pages = %d", pages)
		}
		return "Aarav Example\nSoftware Engineer\naarav@example.test\n", nil
	})
	if err != nil || !called || preview.Format != "PDF (OCR)" || preview.Fields["email"].Value != "aarav@example.test" {
		t.Fatalf("OCR preview = %+v, err = %v", preview, err)
	}
}

package admin

import "testing"

func validKnowledgeInput() KnowledgeInput {
	return KnowledgeInput{
		Slug:       "a-practical-interview-guide",
		Title:      "A practical interview guide",
		Category:   "Interview Preparation",
		Excerpt:    "Plan useful questions and prepare real examples before the interview.",
		Body:       "Start with the actual role. Prepare three examples of your work and explain your contribution. Review them, ask useful questions, and write down what you learned afterward.",
		ImagePath:  "/images/people/recruiter-review.webp",
		ImageAlt:   "Professional reviewing interview notes",
		AuthorName: "SapienWorx Editorial",
		Status:     "draft",
	}
}

func TestKnowledgeValidation(t *testing.T) {
	tests := []struct {
		name     string
		mutate   func(*KnowledgeInput)
		accepted bool
	}{
		{"draft accepted", func(*KnowledgeInput) {}, true},
		{"published accepted", func(in *KnowledgeInput) { in.Status = "published" }, true},
		{"bad slug", func(in *KnowledgeInput) { in.Slug = "../escape" }, false},
		{"bad category", func(in *KnowledgeInput) { in.Category = "Unknown" }, false},
		{"remote image rejected", func(in *KnowledgeInput) { in.ImagePath = "https://example.com/a.webp" }, false},
		{"script image rejected", func(in *KnowledgeInput) { in.ImagePath = "/images/people/x.webp?evil=1" }, false},
		{"short body", func(in *KnowledgeInput) { in.Body = "Too short" }, false},
		{"invalid visibility", func(in *KnowledgeInput) { in.Status = "scheduled" }, false},
		{"negative ordering", func(in *KnowledgeInput) { in.FeaturedOrder = -1 }, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			in := validKnowledgeInput()
			tc.mutate(&in)
			_, err := validateKnowledge(in)
			if tc.accepted && err != nil {
				t.Fatalf("expected valid article: %v", err)
			}
			if !tc.accepted && err == nil {
				t.Fatal("expected invalid article")
			}
		})
	}
}

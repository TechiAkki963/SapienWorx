package profilecontract_test

import (
	"encoding/json"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	c "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

func BenchmarkParserResultValidation(b *testing.B) {
	v, e := candidate.CanonicalContractValidator()
	if e != nil {
		b.Fatal(e)
	}
	p := result(c.ProfileData{Identity: c.Identity{DisplayName: ptr("Synthetic")}})
	for i := 0; i < 100; i++ {
		p.Profile.Skills = append(p.Profile.Skills, c.Skill{Entity: ref("Synthetic skill"), ExperienceMonths: ptr(12)})
	}
	p.FieldMetadata = c.ProposedMetadata(p.Profile, "resume")
	b.ReportAllocs()
	b.ResetTimer()
	for b.Loop() {
		if v.ValidateResult(p, asOf).HasErrors() {
			b.Fatal("fixture invalid")
		}
	}
}

func FuzzDecodeResultNeverPromotesUnknownFields(f *testing.F) {
	f.Add([]byte(`{"contract_version":"v1","profile":{"gender":"unknown"}}`))
	f.Add([]byte(`{"candidate_id":"a","candidate_id":"b"}`))
	f.Add([]byte(`null`))
	p := result(c.ProfileData{Identity: c.Identity{DisplayName: ptr("Synthetic")}})
	raw, _ := json.Marshal(p)
	f.Add(raw)
	f.Fuzz(func(t *testing.T, raw []byte) {
		p, e := c.DecodeResult(raw)
		if e != nil {
			return
		}
		encoded, e := json.Marshal(p)
		if e != nil {
			t.Fatal("decoded contract cannot round-trip")
		}
		if _, e = c.DecodeResult(encoded); e != nil {
			t.Fatal("decoded contract cannot re-decode")
		}
	})
}

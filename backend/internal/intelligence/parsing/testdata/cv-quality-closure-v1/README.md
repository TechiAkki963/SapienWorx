# CV quality closure captures

These four fixed synthetic structured responses are copied from the completed
cv-02 canary and the cv-12/cv-19/cv-18 targeted retest on 19 October 2026. Original
journals and reports remain immutable in `docs/benchmarks/`. Source digests match
the original 20-CV corpus. No expected profile, taxonomy or V1 capture is changed.

`TestCVQualityClosureCapturedPipeline` replays source → original provider-style
JSON → wire schema → normalization/postprocessing → canonical ParserResult and
CandidateProfile validation. The actual cv-18 raw status remains null. The test
requires source-supported recovery, raw-null lineage, unreviewed metadata and
preserved conflicting title/notice. The captures are not new model calls or a
new live baseline. Employment-status inference negatives live in
`employment_status_test.go`.

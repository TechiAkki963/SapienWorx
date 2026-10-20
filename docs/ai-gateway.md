# AI Gateway

The Task 1 foundation has been integrated into the disabled-by-default Phase 1
Go parsing boundary. See [Governed parsing operations](intelligence-v2-openai.md)
for the current architecture, configuration, persistence, privacy and smoke gates.

The product owner explicitly approved OpenAI for this phase. Other external
integrations remain excluded. The official SDK is confined to `openaiadapter`;
product handlers cannot construct it. `scripts/verify-ai-boundary.py` enforces this.

No real provider call, model promotion, merge, push, deployment or activation is
implied by the local implementation. Missing API key is nonfatal. No matching,
ranking, agent, embedding or Rust behavior has been added by Phase 1.

Task 2 CandidateProfile/ParserResult remains authoritative. See
[candidate-profile-contract.md](candidate-profile-contract.md) and
[resume-parser-contract.md](resume-parser-contract.md) for its independent contract
and review guarantees. The implementation evidence and readiness assessment are in
[intelligence-v2-openai-report.md](intelligence-v2-openai-report.md).

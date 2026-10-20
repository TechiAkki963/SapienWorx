# Local OpenAI configuration verification

The existing provider implementation is in the local `codex/intelligence-v2-openai-gateway` checkout. The older primary checkout has no AI gateway. This change adds local configuration support to the existing implementation; it does not import the larger feature into the primary checkout.

## Configuration

- The primary repository's `.env` is ignored and untracked. Its key is present; validity and account/model access have not been tested.
- `OPENAI_ENABLED=false` takes precedence over the legacy `AI_ENABLED` switch. All downstream feature flags remain unchanged.
- Model configuration uses `OPENAI_DEFAULT_MODEL`, `OPENAI_PARSER_MODEL`, and `OPENAI_GENERATION_MODEL`. The existing configuration default remains available; business logic does not select model literals.
- The primary and feature checkout `.env.example` files have an empty API-key/model placeholder and `OPENAI_ENABLED=false`.
- Runtime settings normally come from the existing process environment. For local development only, `SAPIENWORX_OPENAI_ENV_FILE` explicitly opts the backend into reading the named file. No implicit dotenv discovery occurs.
- The loader reads only the five OpenAI settings and optional pricing JSON. It neither evaluates expressions nor mutates environment variables. It rejects beta/production file loading and withholds file contents and paths from errors.
- The frontend has no provider key/configuration export. Secret formatting, logs, JSON configuration diagnostics, provider failures and reflected request IDs are redacted or normalized.
- Provider states remain `not_configured`, `disabled`, `configured`, `healthy`, `degraded`, and `unavailable`; all six are covered by mocks.

## Verification

- Final focused tests: 203 passed test events, 4 skipped, no failures.
- `go vet ./...`: PASS.
- AI source boundary check: PASS.
- Read-only scan: 1,798 repository/browser asset files inspected, no exact-key exposure detected, no frontend provider boundary violations.
- Status-only execution using the local file: `disabled`; the provider factory is never invoked by this command path.
- Configuration validation and in-process HTTP liveness/readiness: PASS with the provider disabled, with and without a key.
- Broader regression run: 600 passed test events, 26 skipped. The existing ClamD clean/infected TCP cases and their parent test failed because the sandbox blocks loopback connections (independent probe: Windows error 10013). No scanner implementation or assertions were changed.
- Database-backed process startup was not verified. Elevated Docker inspection was rejected by automatic approval review; no Docker or database state was changed for this task.
- Evidence is in the ignored `tmp/openai-configuration-*.json`, stderr and vet files. Skipped database gates are not claimed as passing.
- Real OpenAI requests made: **0**. Only synthetic mock/transport fixtures were used. The local file remains disabled.
- No commit, push, merge, deployment, global AI activation, or beta/production changes were performed.

## Later: one explicitly authorized real smoke request

Run this manually from PowerShell only when the billable call is approved:

```powershell
Set-Location 'C:\Users\Admin\Documents\SapienWorx\tmp\intelligence-v2-openai-gateway\backend'
$env:APP_ENV = 'development'
& 'C:\Users\Admin\Documents\SapienWorx\tmp\beta-stage-a-live\tmp\go-1.26.9\go\bin\go.exe' run ./cmd/ai-smoke --openai-env-file 'C:\Users\Admin\Documents\SapienWorx\.env' --enable-openai-for-this-command --confirm-billable-openai-test
```

Both flags are required. CI, beta and production are refused. The override exists only inside the command's configuration object; `OPENAI_ENABLED` in the file and process is never changed. The fixed synthetic input requests exactly `OK`, caps output at 128 tokens, permits one attempt, disables SDK/gateway retries and redirects, and validates the returned status/model/usage/content. The report contains PASS/FAIL, model, latency, request ID, token usage and estimated cost (or `known=false` when rates are unavailable). It never prints credentials, full prompts or response content. No automatic retry is appropriate if the real test fails.

The real smoke command above was **not executed** during this verification.

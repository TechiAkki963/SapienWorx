"""CI source-boundary checks. Never loads keys or calls any provider."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
violations = []
for path in [p for directory in [root / "backend/cmd", root / "backend/internal"] for p in directory.rglob("*.go")]:
    text = path.read_text(encoding="utf-8")
    relative = path.relative_to(root).as_posix()
    if re.search(r'"github\.com/openai/openai-go', text) and "/gateway/openaiadapter/" not in relative:
        violations.append(relative + ": SDK import outside provider adapter")
    if '"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway/openaiadapter"' in text and not relative.startswith(("backend/cmd/api/", "backend/cmd/ai-smoke/", "backend/cmd/ai-parse-smoke/", "backend/cmd/ai-eval/")):
        violations.append(relative + ": provider constructed outside composition roots")
for directory in [root / "frontend/app", root / "frontend/components", root / "frontend/lib", root / "frontend/hooks"]:
    for path in directory.rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".js", ".mjs"}:
            continue
        text = path.read_text(encoding="utf-8")
        if "OPENAI_API_KEY" in text or "api.openai.com" in text or re.search(r'from\s+[\'"]openai', text):
            violations.append(str(path.relative_to(root)) + ": frontend provider boundary violation")
server = (root / "backend/internal/platform/httpserver/server.go").read_text(encoding="utf-8")
if re.search(r'POST /api/(?:v1/)?ai/(?:prompt|generate|responses)', server):
    violations.append("generic public generation route")
if violations:
    raise SystemExit("\n".join(violations))
print("PASS: SDK confined to adapter, provider construction confined to composition roots, no browser provider calls or generic prompt route.")

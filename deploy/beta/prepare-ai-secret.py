"""Prepare a private, DISABLED beta AI env file from existing SSM JSON on stdin.

Run only in an approved private operator session. Never pass a key as an argument.
This script creates no AWS resource and does not enable AI or deploy anything.
"""
import json
import base64
import os
from pathlib import Path
import re
import sys


def prepare(raw, directory):
    parameters=raw.get("Parameters",[raw.get("Parameter",{})])
    expected={"/sapienworx/beta/OPENAI_API_KEY","/sapienworx/beta/AI_ARTIFACT_ENCRYPTION_KEY"}
    if not isinstance(parameters,list) or len(parameters)!=2 or {p.get("Name") for p in parameters}!=expected or any(p.get("Type")!="SecureString" for p in parameters):
        raise ValueError("Expected both exact beta SecureStrings")
    values={p["Name"]:p.get("Value","") for p in parameters}
    key=values["/sapienworx/beta/OPENAI_API_KEY"]
    artifact=values["/sapienworx/beta/AI_ARTIFACT_ENCRYPTION_KEY"]
    if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_.-]{16,1024}", key):
        raise ValueError("Invalid secret format")
    if not isinstance(artifact,str) or len(base64.b64decode(artifact,validate=True))!=32 or key==artifact:
        raise ValueError("Invalid distinct proposal encryption key")
    pricing_path=Path(__file__).with_name("ai-pricing.v1.json")
    if not pricing_path.exists():pricing_path=Path(__file__).resolve().parents[2]/"config/ai-pricing.v1.json"
    pricing=json.loads(pricing_path.read_text())
    models={name:{**price,"version":pricing["version"]} for name,price in pricing["models"].items()}
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    if directory.is_symlink():
        raise ValueError("Runtime directory cannot be a symlink")
    path = directory / "ai.env"
    # Never overwrite an existing operator's configuration. No key in stdout.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
        stream.write("AI_ENABLED=false\nOPENAI_ENABLED=false\nOPENAI_DEFAULT_MODEL=gpt-6-luna\nOPENAI_API_KEY="+key+"\nAI_ARTIFACT_ENCRYPTION_KEY="+artifact+"\nAI_MODEL_PRICING_JSON="+json.dumps(models,separators=(',',':'))+"\n")
    return path


if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise ValueError("No command arguments accepted")
        prepare(json.load(sys.stdin), Path(__file__).resolve().parent / "runtime")
    except Exception:
        print("Beta AI secret preparation failed; input and credentials withheld.", file=sys.stderr)
        raise SystemExit(1)
    print("Private beta AI configuration prepared. AI_ENABLED=false; no activation or deployment performed.")

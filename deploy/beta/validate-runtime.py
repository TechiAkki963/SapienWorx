"""Validate decrypted beta SSM response on stdin without logging values."""
import json
import re
import sys
from urllib.parse import urlsplit, parse_qs

ROOT = "/sapienworx/beta/"


def validate(response):
    if response.get("InvalidParameters"):
        raise ValueError("required beta parameters are missing")
    values = {p["Name"].removeprefix(ROOT): p["Value"] for p in response["Parameters"]
              if p["Name"].startswith(ROOT)}
    endpoint = values["RDS_ENDPOINT"]
    if not re.fullmatch(r"sapienworx-production-postgres\.[a-z0-9.-]+\.rds\.amazonaws\.com", endpoint):
        raise ValueError("expected the approved shared RDS endpoint")
    passwords = []
    for key, role in [("DATABASE_URL", "sapienworx_beta_app"),
                      ("INTELLIGENCE_DATABASE_URL", "sapienworx_beta_intelligence"),
                      ("MIGRATION_DATABASE_URL", "sapienworx_beta_migrator")]:
        value = values[key]
        if any(c in value for c in "\r\n$'\\\"\x00"):
            raise ValueError("unsafe dotenv characters in database URL")
        url = urlsplit(value)
        query = parse_qs(url.query)
        if (url.scheme not in ("postgres", "postgresql") or url.hostname != endpoint or
                url.port not in (None, 5432) or url.path != "/sapienworx_beta" or
                url.username != role or not url.password or url.fragment or
                set(query) != {"sslmode"} or
                query.get("sslmode") not in (["require"], ["verify-ca"], ["verify-full"])):
            raise ValueError("database URL does not match isolated beta database/role/TLS policy")
        passwords.append(url.password)
    if len(set(passwords)) != 3:
        raise ValueError("beta database roles require distinct passwords")
    for key in ("JWT_SECRET", "AUTH_OTP_HMAC_SECRET"):
        if not re.fullmatch(r"[A-Za-z0-9+/=_-]{32,}", values[key]):
            raise ValueError("beta authentication secret must be strong and dotenv-safe")
    if values["JWT_SECRET"] == values["AUTH_OTP_HMAC_SECRET"]:
        raise ValueError("beta authentication secrets must be distinct")
    if not re.fullmatch(r"sapienworx-beta-documents-\d{12}-ap-south-1", values["S3_BUCKET"]):
        raise ValueError("expected the isolated beta S3 bucket")
    return values


if __name__ == "__main__":
    try:
        validate(json.load(sys.stdin))
    except (ValueError, KeyError, TypeError):
        sys.exit("Beta runtime validation failed; check parameter metadata and the bootstrap runbook.")

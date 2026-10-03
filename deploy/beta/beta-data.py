"""Host-only beta data operations. Never pass credentials on the command line."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("runtime", ROOT / "validate-runtime.py")
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


def aws(*args, data=None):
    return subprocess.check_output(["aws", "--region", "ap-south-1", *args],
                                   input=data, stderr=subprocess.DEVNULL)


def parameters():
    names = [runtime.ROOT + k for k in ("DATABASE_URL", "INTELLIGENCE_DATABASE_URL",
             "MIGRATION_DATABASE_URL", "JWT_SECRET", "AUTH_OTP_HMAC_SECRET", "S3_BUCKET", "RDS_ENDPOINT")]
    return runtime.validate(json.loads(aws("ssm", "get-parameters", "--with-decryption", "--names", *names)))


def account_secrets():
    names = [runtime.ROOT + "test-accounts/" + r for r in ("candidate", "recruiter", "master_admin")]
    response = json.loads(aws("ssm", "get-parameters", "--with-decryption", "--names", *names))
    if response.get("InvalidParameters") or len(response["Parameters"]) != 3:
        raise ValueError("test accounts must be provisioned by the owner first")
    return {p["Name"].rsplit("/", 1)[1]: json.loads(p["Value"]) for p in response["Parameters"]}


def seed_environment(values, accounts):
    db = urlsplit(values["MIGRATION_DATABASE_URL"])
    return {"PGHOST": db.hostname, "PGPORT": str(db.port or 5432), "PGDATABASE": "sapienworx_beta",
            "PGUSER": "sapienworx_migrator", "PGPASSWORD": unquote(db.password), "PGSSLMODE": "require",
            **{f"BETA_{role.upper()}_HASH": a["hash"] for role, a in accounts.items()},
            **({"BETA_FIXTURE_HASH": accounts["candidate"]["hash"]} if accounts else {})}


def run_postgres(image, env, command, stdin=None):
    # Env values never enter process arguments or the repository.
    fd, filename = tempfile.mkstemp(prefix="beta-data-", dir=ROOT / "runtime")
    try:
        os.chmod(filename, 0o600)
        with os.fdopen(fd, "w") as f:
            for key, value in env.items():
                if "\n" in value or "\r" in value: raise ValueError("unsafe environment value")
                f.write(f"{key}={value}\n")
        return subprocess.check_output(["docker", "run", "--rm", "-i", "--network", "sapienworx_beta_proxy",
                   "--env-file", filename, "--entrypoint", command[0], image, *command[1:]],
                   input=stdin, stderr=subprocess.DEVNULL)
    finally:
        os.unlink(filename)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["accounts", "seed", "backup", "restore", "reset"])
    parser.add_argument("--confirm", required=True)
    parser.add_argument("--file", type=Path)
    args = parser.parse_args()
    if args.confirm != "sapienworx-beta": raise ValueError("exact beta confirmation required")
    # Re-validate against beta SSM and the host release record on every invocation.
    values = parameters()
    sha = (ROOT / "runtime/deployed-sha").read_text().strip()
    if len(sha) != 40 or any(c not in "0123456789abcdef" for c in sha): raise ValueError("invalid deployed SHA")
    account = json.loads(aws("sts", "get-caller-identity"))["Account"]
    image = f"{account}.dkr.ecr.ap-south-1.amazonaws.com/sapienworx-beta/migration:{sha}"
    if args.action == "accounts":
        # Owner only: host role has read-only SSM access, so this needs temporary
        # authorized SSO credentials. Existing accounts are never silently rotated.
        names = [runtime.ROOT + "test-accounts/" + r for r in ("candidate", "recruiter", "master_admin")]
        existing = json.loads(aws("ssm", "get-parameters", "--names", *names))
        if existing.get("Parameters"): raise ValueError("test accounts already exist; use controlled owner rotation")
        accounts = json.loads(subprocess.check_output(["docker", "run", "--rm", "--entrypoint",
                     "sapienworx-beta-accounts", image], stderr=subprocess.DEVNULL))
        for role, credentials in accounts.items():
            body = json.dumps({"Name": runtime.ROOT + "test-accounts/" + role,
                               "Type": "SecureString", "Value": json.dumps(credentials)})
            aws("ssm", "put-parameter", "--cli-input-json", "file:///dev/stdin", data=body.encode())
        print("Beta account credentials stored privately in SSM; no values logged.")
        return
    env = seed_environment(values, account_secrets() if args.action in ("seed", "reset") else {})
    if args.action == "backup":
        if args.file is None or args.file.exists(): raise ValueError("choose a new private backup path")
        backup = run_postgres(image, env, ["pg_dump", "--format=custom", "--no-owner", "--no-acl"])
        with os.fdopen(os.open(args.file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as f: f.write(backup)
    elif args.action == "restore":
        # Restore only into a fresh isolated database, never overwrite existing data.
        if args.file is None: raise ValueError("backup file required")
        count = run_postgres(image, env, ["psql", "-Atc", "SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','intelligence');"])
        if count.strip() != b"0": raise ValueError("restore requires a fresh empty beta database")
        run_postgres(image, env, ["pg_restore", "--exit-on-error", "--no-owner", "--no-acl", "--dbname=sapienworx_beta"], args.file.read_bytes())
    else:
        if args.action == "reset":
            # Reset synthetic records, preserve schema/migrations and runtime roles.
            if args.file is None: raise ValueError("reset requires --file <new-backup-path>")
            backup = run_postgres(image, env, ["pg_dump", "--format=custom", "--no-owner", "--no-acl"])
            with os.fdopen(os.open(args.file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as f: f.write(backup)
            run_postgres(image, env, ["psql", "-v", "ON_ERROR_STOP=1", "-c", "TRUNCATE users, companies CASCADE;"])
        run_postgres(image, env, ["psql", "-v", "ON_ERROR_STOP=1", "-f", "/beta-seed.sql"])
    print("Beta data operation completed; no credentials logged.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError):
        raise SystemExit("Beta data operation refused or failed; inspect the runbook and parameter metadata.")

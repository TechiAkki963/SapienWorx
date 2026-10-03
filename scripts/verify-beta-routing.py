"""Verify Caddy's parsed routing tree, including environment hostname boundaries."""
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
result = subprocess.run(
    ["docker", "run", "--rm", "-e", "ACME_EMAIL=info@sapienworx.com",
     "-v", f"{ROOT / 'deploy/beta/Caddyfile'}:/etc/caddy/Caddyfile:ro",
     "caddy:2.10.2-alpine", "caddy", "adapt", "--config", "/etc/caddy/Caddyfile"],
    check=True, capture_output=True, text=True,
)
config = json.loads(result.stdout)
hosts = set()
upstreams = set()


def inspect(value, inherited_hosts=frozenset()):
    if isinstance(value, list):
        for item in value:
            inspect(item, inherited_hosts)
    elif isinstance(value, dict):
        route_hosts = set(inherited_hosts)
        for matcher in value.get("match", []):
            route_hosts.update(matcher.get("host", []))
        hosts.update(route_hosts)
        if value.get("handler") == "reverse_proxy":
            if route_hosts != {"beta.sapienworx.com"}:
                raise AssertionError(f"Application proxy reachable on unexpected hosts: {route_hosts}")
            upstreams.update(item["dial"] for item in value["upstreams"])
        for key, child in value.items():
            if key != "match":
                inspect(child, frozenset(route_hosts))


inspect(config)
assert hosts == {"beta.sapienworx.com", "127.0.0.1"}, hosts
assert upstreams == {"backend:8080", "frontend:3000"}, upstreams
message = "PASS: adapted Caddy exposes application upstreams only on beta.sapienworx.com; no production hostname or redirect.\n"
(ROOT / "docs/p3/evidence/beta-routing.txt").write_text(message, encoding="utf-8")
print(message, end="")

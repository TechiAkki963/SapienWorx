"""Exercise hostname routing in disposable Caddy containers, with stub beta APIs."""
from http.client import HTTPConnection
import pathlib
import subprocess
import tempfile
import time
import uuid

root = pathlib.Path(__file__).resolve().parents[1]


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True, stderr=subprocess.PIPE).strip()


network = "sapienworx-edge-test-" + uuid.uuid4().hex[:10]
containers = []
messages = []
with tempfile.TemporaryDirectory(prefix="edge-test-", dir=root / "tmp") as temp:
    work = pathlib.Path(temp)
    config = (root / "deploy/beta/Caddyfile.shared").read_text()
    config = config.replace("sapienworx.com, www.sapienworx.com {", "http://sapienworx.com:8081, http://www.sapienworx.com:8081 {")
    config = config.replace("beta.sapienworx.com {", "http://beta.sapienworx.com:8081 {")
    (work / "edge.Caddyfile").write_text(config)
    (work / "stub.Caddyfile").write_text(':8080 {\n respond "beta-backend" 200\n}\n:3000 {\n respond "beta-frontend" 200\n}\n')
    docker("network", "create", network)
    try:
        stub = docker("run", "-d", "--network", network, "--network-alias", "backend", "--network-alias", "frontend",
                      "-v", f"{work / 'stub.Caddyfile'}:/etc/caddy/Caddyfile:ro", "caddy:2.10.2-alpine")
        containers.append(stub)
        edge = docker("run", "-d", "--network", network, "-e", "ACME_EMAIL=info@sapienworx.com", "-p", "127.0.0.1::8081",
                      "-v", f"{work / 'edge.Caddyfile'}:/etc/caddy/Caddyfile:ro",
                      "-v", f"{root / 'deploy/holding/public'}:/srv/holding:ro", "caddy:2.10.2-alpine")
        containers.append(edge)
        port = int(docker("port", edge, "8081/tcp").split(":")[-1])

        def request(host, path):
            connection = HTTPConnection("127.0.0.1", port, timeout=5)
            try:
                connection.request("GET", path, headers={"Host": host})
                response = connection.getresponse()
                return response.status, response.read()
            finally:
                connection.close()

        for attempt in range(30):
            try:
                if request("sapienworx.com", "/")[0] == 200:
                    break
            except OSError:
                pass
            time.sleep(0.2)
        approved = (root / "deploy/holding/public/index.html").read_bytes()
        for host in ["sapienworx.com", "www.sapienworx.com"]:
            status, body = request(host, "/")
            assert status == 200 and body == approved, (host, status)
            for path in ["/api", "/api/v1/auth/login", "/health/ready"]:
                assert request(host, path)[0] == 404, (host, path)
            assert request(host, "/mascot.png")[1] == (root / "deploy/holding/public/mascot.png").read_bytes()
            messages.append(f"PASS: {host} exact approved page/asset; application paths return 404.")
        assert request("beta.sapienworx.com", "/") == (200, b"beta-frontend")
        assert request("beta.sapienworx.com", "/api/v1/auth/login") == (200, b"beta-backend")
        assert request("beta.sapienworx.com", "/health/ready") == (200, b"beta-backend")
        unknown_status, unknown_body = request("unknown.example.test", "/api/v1/auth/login")
        assert unknown_status in (200, 404) and not unknown_body
        messages.append("PASS: beta host routes frontend/API to beta-only stubs; unknown host has no application content.")
    finally:
        for container in reversed(containers):
            docker("rm", "-f", container)
        docker("network", "rm", network)
(root / "docs/p3/evidence/shared-edge.txt").write_text("\n".join(messages) + "\n")
print("\n".join(messages))

"""Exercise hostname routing in disposable Caddy containers, with stub beta APIs."""
from http.client import HTTPConnection
import socket
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
    holding = (root / "deploy/beta/Caddyfile.holding-admin").read_text().replace("sapienworx.com, www.sapienworx.com {", "http://sapienworx.com:8081, http://www.sapienworx.com:8081 {")
    (work / "Caddyfile").write_text(holding)
    docker("network", "create", network)
    try:
        stub = docker("run", "-d", "--network", network, "--network-alias", "backend", "--network-alias", "frontend",
                      "-v", f"{root / 'scripts/edge-test-upstreams.py'}:/stub.py:ro", "python:3.12-alpine", "python", "/stub.py")
        containers.append(stub)
        edge = docker("run", "-d", "--network", network, "--network-alias", "edge", "-e", "ACME_EMAIL=info@sapienworx.com", "-p", "127.0.0.1::8081",
                      "-v", f"{work}:/etc/caddy:ro",
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
        started = docker("inspect", "--format", "{{.State.StartedAt}}", edge)
        assert not request("beta.sapienworx.com", "/")[1]
        docker("exec", edge, "caddy", "validate", "--config", "/etc/caddy/edge.Caddyfile", "--adapter", "caddyfile")
        docker("exec", edge, "caddy", "reload", "--address", "127.0.0.1:2020", "--config", "/etc/caddy/edge.Caddyfile", "--adapter", "caddyfile")
        assert docker("inspect", "--format", "{{.State.StartedAt}}", edge) == started
        # Loopback admin must not be reachable from another container on the proxy network.
        isolated = subprocess.run(["docker", "exec", stub, "python", "-c", "import socket; socket.create_connection(('edge',2020),timeout=2)"], capture_output=True)
        assert isolated.returncode != 0
        for host in ["sapienworx.com", "www.sapienworx.com"]:
            status, body = request(host, "/")
            assert status == 200 and body == approved, (host, status)
            for path in ["/api", "/api/v1/auth/login", "/health/ready", "/admin", "/recruiter", "/candidate", "/api/v1/messaging/threads/test/ws"]:
                assert request(host, path)[0] == 404, (host, path)
            assert request(host, "/mascot.png")[1] == (root / "deploy/holding/public/mascot.png").read_bytes()
            messages.append(f"PASS: {host} exact approved page/asset; application paths return 404.")
        assert request("beta.sapienworx.com", "/") == (200, b"beta-frontend")
        assert request("beta.sapienworx.com", "/api/v1/auth/login") == (200, b"beta-backend")
        assert request("beta.sapienworx.com", "/health/ready") == (200, b"beta-backend")
        assert request("beta.sapienworx.com", "/health/live") == (200, b"beta-backend")
        with socket.create_connection(("127.0.0.1", port), timeout=5) as websocket:
            websocket.sendall(b"GET /api/v1/messaging/threads/test/ws HTTP/1.1\r\nHost: beta.sapienworx.com\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n")
            response = b""
            while b"\r\n\r\n" not in response:
                response += websocket.recv(1)
            assert b"101 Switching Protocols" in response
            assert b"s3pPLMBiTxaQ9kYGzzhZRbK+xOo=" in response
            websocket.sendall(b"\x81\x85\0\0\0\0hello")
            echoed = b""
            while len(echoed) < 7:
                echoed += websocket.recv(7 - len(echoed))
            assert echoed == b"\x81\x05hello"
        unknown_status, unknown_body = request("unknown.example.test", "/api/v1/auth/login")
        assert unknown_status in (200, 404) and not unknown_body
        for path in ["/", "/admin", "/health/ready", "/api/v1/messaging/threads/test/ws"]:
            assert not request("unknown.example.test", path)[1]
        messages.append("PASS: beta host routes frontend/API to beta-only stubs; unknown host has no application content.")
        # Invalid candidate is rejected while public/beta routes keep serving.
        (work / "invalid").write_text("invalid { broken_directive }\n")
        rejected = subprocess.run(["docker", "exec", edge, "caddy", "reload", "--address", "127.0.0.1:2020", "--config", "/etc/caddy/invalid", "--adapter", "caddyfile"], capture_output=True)
        assert rejected.returncode != 0
        assert request("www.sapienworx.com", "/") == (200, approved)
        assert request("beta.sapienworx.com", "/") == (200, b"beta-frontend")
        docker("exec", edge, "caddy", "reload", "--address", "127.0.0.1:2020", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile")
        assert request("www.sapienworx.com", "/") == (200, approved)
        assert not request("beta.sapienworx.com", "/")[1]
        assert docker("inspect", "--format", "{{.State.StartedAt}}", edge) == started
        messages.append("PASS: holding-only bootstrap, graceful beta reload, rejected invalid config and holding-only rollback keep the same Caddy process; admin isolated; WebSocket 101 and echo pass.")
    finally:
        for container in reversed(containers):
            docker("rm", "-f", container)
        docker("network", "rm", network)
(root / "docs/p3/evidence/shared-edge.txt").write_text("\n".join(messages) + "\n")
print("\n".join(messages))

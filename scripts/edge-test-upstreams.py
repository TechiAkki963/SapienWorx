"""Disposable HTTP/WebSocket upstreams; never used in the deployed application."""
import base64
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get('Upgrade', '').lower() == 'websocket':
            accept = base64.b64encode(hashlib.sha1((self.headers['Sec-WebSocket-Key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
            self.send_response(101)
            self.send_header('Upgrade', 'websocket')
            self.send_header('Connection', 'Upgrade')
            self.send_header('Sec-WebSocket-Accept', accept)
            self.end_headers()
            header = self.rfile.read(2)
            length = header[1] & 127
            mask = self.rfile.read(4)
            payload = self.rfile.read(length)
            decoded = bytes(v ^ mask[i % 4] for i, v in enumerate(payload))
            self.wfile.write(bytes([129, len(decoded)]) + decoded)
            self.wfile.flush()
            return
        body = b'beta-backend' if self.server.server_port == 8080 else b'beta-frontend'
        self.send_response(200)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


threading.Thread(target=ThreadingHTTPServer(('0.0.0.0', 8080), Handler).serve_forever, daemon=True).start()
ThreadingHTTPServer(('0.0.0.0', 3000), Handler).serve_forever()

"""No request bytes or scanner response contents are logged."""
import json,pathlib,socket,time,sys
MAX_AGE=36*3600
def fresh(timestamp,now=None):
    now=time.time() if now is None else now
    return 0 <= now-timestamp <= MAX_AGE
def healthy():
    try:
        state=json.loads(pathlib.Path('/var/lib/clamav/verified.json').read_text())
        if not fresh(state['verified_at']):return False
        with socket.create_connection(('127.0.0.1',3310),timeout=3) as conn:
            conn.sendall(b'zPING\0');return conn.recv(16)==b'PONG\0'
    except (OSError,ValueError,KeyError,TypeError):return False
if __name__=='__main__':sys.exit(0 if healthy() else 1)

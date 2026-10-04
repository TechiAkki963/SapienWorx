"""Stage B HTTPS and synthetic role-access smoke; secrets remain in process memory."""
import http.cookiejar
import importlib.util
import json
from pathlib import Path
import urllib.request
import urllib.error
import urllib.parse

ROOT = Path(__file__).resolve().parent
ORIGIN = 'https://beta.sapienworx.com'
spec = importlib.util.spec_from_file_location('data', ROOT / 'beta-data.py')
data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(data)


def verify():
    for path in ['/health/live', '/health/ready']:
        with urllib.request.urlopen(ORIGIN + path, timeout=15) as response:
            if response.status != 200:
                raise ValueError('public health failed')
    accounts = data.account_secrets()
    for role, email, portal in [('candidate', 'candidate.beta@example.test', '/candidate'), ('recruiter', 'recruiter.beta@example.test', '/recruiter'), ('master_admin', 'admin.beta@example.test', '/swx-command-centre/overview')]:
        jar = http.cookiejar.CookieJar()
        client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        def request(path, payload=None):
            headers = {'Origin': ORIGIN, 'Content-Type': 'application/json'}
            csrf = next((cookie.value for cookie in jar if cookie.name == 'sw_csrf'), None)
            if csrf:
                headers['X-CSRF-Token'] = csrf
            req = urllib.request.Request(ORIGIN + path, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
            return client.open(req, timeout=20)
        logged_in = False
        try:
            with request('/api/v1/auth/login', {'email': email, 'password': accounts[role]['password'], 'role': role}) as response:
                logged_in = True
                if json.load(response)['role'] != role:
                    raise ValueError('login role differs')
            if not jar or any(not cookie.secure for cookie in jar):
                raise ValueError('secure authentication cookies required')
            with request('/api/v1/auth/me') as response:
                if json.load(response)['role'] != role:
                    raise ValueError('session role differs')
            endpoint = 'admin' if role == 'master_admin' else role
            with request(f'/api/v1/{endpoint}/dashboard') as response:
                if response.status != 200:
                    raise ValueError('role dashboard failed')
            with request(portal) as response:
                if response.status != 200 or urllib.parse.urlsplit(response.url).path != portal:
                    raise ValueError('portal access redirected or failed')
            if role != 'master_admin':
                try:
                    request('/api/v1/admin/dashboard').close()
                except urllib.error.HTTPError as error:
                    if error.code != 403:
                        raise
                else:
                    raise ValueError('admin route accessible to non-admin')
        finally:
            if logged_in:
                with request('/api/v1/auth/logout', {}) as response:
                    if response.status != 204:
                        raise ValueError('logout failed')
        print(f'PASS: {role} synthetic HTTPS login, session, API dashboard, portal access and logout.')


if __name__ == '__main__':
    try:
        verify()
    except Exception:
        raise SystemExit('Public beta access verification failed; response bodies, cookies and credentials suppressed. MFA/access-policy requirements must be satisfied without bypass.')

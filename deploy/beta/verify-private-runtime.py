"""Stage A read-only private runtime gate. Never logs credentials or requires public beta."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('data', ROOT / 'beta-data.py')
data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(data)


def verify(sha):
    if not re.fullmatch('[0-9a-f]{40}', sha):
        raise ValueError('full immutable SHA required')
    if (ROOT / 'runtime/deployed-sha').read_text().strip() != sha:
        raise ValueError('deployed SHA differs')
    values = data.parameters()
    configured = dict(line.split('=', 1) for line in (ROOT / 'runtime/beta.env').read_text().splitlines() if '=' in line)
    for key in ['DATABASE_URL', 'INTELLIGENCE_DATABASE_URL', 'JWT_SECRET', 'AUTH_OTP_HMAC_SECRET', 'S3_BUCKET']:
        if configured.get(key) != values[key]:
            raise ValueError('runtime parameters differ from beta SSM')
    migration_config = dict(line.split('=', 1) for line in (ROOT / 'runtime/migration.env').read_text().splitlines() if '=' in line)
    if migration_config.get('DATABASE_URL') != values['MIGRATION_DATABASE_URL']:
        raise ValueError('migrator configuration differs from beta SSM')
    account = json.loads(data.aws('sts', 'get-caller-identity'))['Account']
    registry = f'{account}.dkr.ecr.ap-south-1.amazonaws.com/sapienworx-beta'
    for component in ['backend', 'frontend', 'intelligence']:
        observed = json.loads(subprocess.check_output(['docker', 'inspect', f'sapienworx-beta-{component}'], stderr=subprocess.DEVNULL))[0]
        if observed['State']['Health']['Status'] != 'healthy' or observed['Config']['Image'] != f'{registry}/{component}:{sha}':
            raise ValueError('container health or immutable image differs')
        env = dict(line.split('=', 1) for line in observed['Config']['Env'] if '=' in line)
        if component != 'frontend' and env.get('APP_ENV') != 'beta':
            raise ValueError('container environment differs')
        if component == 'backend' and (env.get('DATABASE_URL') != values['DATABASE_URL'] or env.get('CORS_ALLOWED_ORIGINS') != 'https://beta.sapienworx.com' or env.get('AUTH_COOKIE_SECURE') != 'true'):
            raise ValueError('backend isolation configuration differs')
        if component == 'backend' and any(env.get(key) != values[key] for key in ['JWT_SECRET', 'AUTH_OTP_HMAC_SECRET', 'S3_BUCKET']):
            raise ValueError('running backend parameters differ from beta SSM')
        if component == 'frontend' and env.get('INTERNAL_API_URL') != 'http://backend:8080':
            raise ValueError('frontend upstream differs from private beta backend')
        if component == 'intelligence' and env.get('INTELLIGENCE_DATABASE_URL') != values['INTELLIGENCE_DATABASE_URL']:
            raise ValueError('worker database configuration differs')
    image = f'{registry}/migration:{sha}'
    command = 'for f in /migrations/*.up.sql; do printf "%s|" "$(basename "$f" .up.sql)"; sed "s/\\r$//" "$f" | sha256sum | cut -d" " -f1; done'
    expected = subprocess.check_output(['docker', 'run', '--rm', '--network', 'none', '--entrypoint', 'sh', image, '-c', command], stderr=subprocess.DEVNULL).decode().splitlines()
    if not expected:
        raise ValueError('migration manifest is empty')
    for key in ['DATABASE_URL', 'INTELLIGENCE_DATABASE_URL', 'MIGRATION_DATABASE_URL']:
        url = urlsplit(values[key])
        env = {'PGHOST': url.hostname, 'PGPORT': str(url.port or 5432), 'PGDATABASE': 'sapienworx_beta', 'PGUSER': url.username, 'PGPASSWORD': unquote(url.password), 'PGSSLMODE': 'require', 'PGOPTIONS': '-c default_transaction_read_only=on'}
        query = "SELECT current_database(),current_user,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),has_database_privilege(current_user,'sapienworx','CONNECT'),has_database_privilege(current_user,'sapienworx','TEMPORARY');"
        observed = data.run_postgres(image, env, ['psql', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query]).decode().strip()
        if observed != f'sapienworx_beta|{url.username}|t|f|f':
            raise ValueError('database target, TLS or production isolation failed')
        if key == 'MIGRATION_DATABASE_URL':
            ledger = data.run_postgres(image, env, ['psql', '-At', '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT version,checksum FROM schema_migrations ORDER BY version;']).decode().splitlines()
            if sorted(ledger) != sorted(expected):
                raise ValueError('migration ledger differs from deployed image')
    print(f'PASS: private runtime {sha}; three healthy immutable containers; beta configuration, database TLS/isolation and {len(expected)} migration checksums verified.')


if __name__ == '__main__':
    try:
        verify(sys.argv[1])
    except Exception:
        raise SystemExit('Private beta runtime verification failed; credentials and detailed database errors suppressed.')

import json, os, pathlib, secrets, subprocess, tempfile, time

root=pathlib.Path.cwd()
(root/'tmp').mkdir(exist_ok=True)
(root/'docs/p3/evidence').mkdir(parents=True,exist_ok=True)
evidence=root/'docs/p3/evidence/beta-database.txt'
suffix=secrets.token_hex(4)
network='sapienworx-p3-beta-rehearsal-'+suffix
container='sapienworx-p3-beta-postgres-'+suffix
image='sapienworx-p3-beta-migration:test'
password=secrets.token_urlsafe(32)
logs=[]
network_created=False
container_created=False

def run(*args,input=None):
    result=subprocess.run(['docker',*args],input=input,capture_output=True)
    if result.returncode:
        # These SQL scripts contain only hashes and synthetic data, never passwords.
        logs.append(result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))
        raise RuntimeError('local beta rehearsal failed')
    return result.stdout

def envfile(values):
    fd,p=tempfile.mkstemp(dir=root/'tmp',suffix='.env')
    with os.fdopen(fd,'w') as f: f.write('\n'.join(k+'='+v for k,v in values.items())+'\n')
    return p

files=[]
try:
    pg=envfile({'POSTGRES_PASSWORD':password,'POSTGRES_USER':'sapienworx_admin','POSTGRES_DB':'sapienworx_beta'})
    files.append(pg)
    run('network','create',network)
    network_created=True
    run('run','-d','--name',container,'--network',network,'--env-file',pg,'postgres:17-alpine')
    container_created=True
    for _ in range(60):
        if subprocess.run(['docker','exec',container,'pg_isready','-U','sapienworx_admin','-d','sapienworx_beta'],capture_output=True).returncode==0: break
        time.sleep(1)
    run('exec',container,'psql','-U','sapienworx_admin','-d','sapienworx_beta','-v','ON_ERROR_STOP=1','-c','CREATE ROLE sapienworx_app NOLOGIN; CREATE ROLE sapienworx_migrator NOLOGIN; CREATE ROLE sapienworx_intelligence NOLOGIN;')
    role_passwords={key:secrets.token_urlsafe(32) for key in ['SAPIENWORX_APP_PASSWORD','SAPIENWORX_MIGRATION_PASSWORD','SAPIENWORX_INTELLIGENCE_PASSWORD']}
    bootstrap=envfile({'PGHOST':container,'PGDATABASE':'sapienworx_beta','PGUSER':'sapienworx_admin','PGPASSWORD':password,**role_passwords})
    files.append(bootstrap)
    logs.append(run('run','--rm','--network',network,'--env-file',bootstrap,'--entrypoint','psql',image,'-v','ON_ERROR_STOP=1','-v','database_name=sapienworx_beta','-f','/beta-bootstrap-roles.sql').decode())
    migration_password=role_passwords['SAPIENWORX_MIGRATION_PASSWORD']
    migration=envfile({'DATABASE_URL':f'postgres://sapienworx_beta_migrator:{migration_password}@{container}/sapienworx_beta?sslmode=disable'})
    files.append(migration)
    logs.append(run('run','--rm','--network',network,'--env-file',migration,image).decode())
    accounts=json.loads(run('run','--rm','--entrypoint','sapienworx-beta-accounts',image))
    seed=envfile({'PGHOST':container,'PGDATABASE':'sapienworx_beta','PGUSER':'sapienworx_admin','PGPASSWORD':password,
                 'BETA_FIXTURE_HASH':accounts['candidate']['hash'],**{f'BETA_{r.upper()}_HASH':v['hash'] for r,v in accounts.items()}})
    files.append(seed)
    for _ in range(2):
        logs.append(run('run','--rm','--network',network,'--env-file',seed,'--entrypoint','psql',image,'-v','ON_ERROR_STOP=1','-f','/beta-seed.sql').decode())
    checks="SELECT role, count(*) FROM users WHERE is_active GROUP BY role ORDER BY role; SELECT count(*) FROM jobs; SELECT count(*) FROM schema_migrations; SELECT count(*) FROM users WHERE password_hash !~ '^\\$2[aby]\\$12\\$';"
    report=run('exec',container,'psql','-U','sapienworx_admin','-d','sapienworx_beta','-Atc',checks).decode()
    logs.append(report)
    migration_count=len(list((root/'database/migrations').glob('*.up.sql')))
    assert report.strip().splitlines()==['candidate|1','recruiter|1','master_admin|1','20',str(migration_count),'0']
    privileges=run('exec',container,'psql','-U','sapienworx_admin','-d','sapienworx_beta','-Atc',"SELECT has_table_privilege('sapienworx_beta_app','jobs','SELECT'), has_table_privilege('sapienworx_app','jobs','SELECT'); SELECT count(*) FROM pg_roles WHERE rolname IN ('sapienworx_app','sapienworx_migrator','sapienworx_intelligence') AND NOT rolcanlogin;").decode()
    assert privileges.strip().splitlines()==['t|f','3'], privileges
    logs.append('PASS: beta application has read privileges; production role names receive no beta job access and remain unchanged NOLOGIN fixture roles.\n')
    dump=run('exec',container,'pg_dump','-U','sapienworx_admin','-d','sapienworx_beta','-Fc','--no-owner','--no-acl')
    run('exec',container,'createdb','-U','sapienworx_admin','sapienworx_beta_restore')
    run('exec','-i',container,'pg_restore','-U','sapienworx_admin','-d','sapienworx_beta_restore','--exit-on-error','--no-owner','--no-acl',input=dump)
    source=run('exec',container,'psql','-U','sapienworx_admin','-d','sapienworx_beta','-Atc','SELECT count(*) FROM jobs;')
    restored=run('exec',container,'psql','-U','sapienworx_admin','-d','sapienworx_beta_restore','-Atc','SELECT count(*) FROM jobs;')
    assert source==restored
    logs.append('PASS: isolated beta roles; all migrations as beta migrator; seed twice; bcrypt hashes only; backup/restore to a separate local database; identical job counts.\n')
finally:
    if container_created: subprocess.run(['docker','rm','-f',container],capture_output=True)
    if network_created: subprocess.run(['docker','network','rm',network],capture_output=True)
    for p in files: os.unlink(p)
    evidence.write_text(''.join(logs),encoding='utf8')

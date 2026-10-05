"""Private signature mirror only. ClamD receives INSTREAM bytes, no S3 CV access."""
import hashlib,json,os,pathlib,subprocess,time
import boto3
from health import fresh
ROOT=pathlib.Path('/var/lib/clamav')
FILES={'main.cvd','daily.cvd','bytecode.cvd','main.cld','daily.cld','bytecode.cld'}
def refresh(client,bucket):
    manifest=json.loads(client.get_object(Bucket=bucket,Key='verified/current.json')['Body'].read(16384))
    if not fresh(manifest['verified_at']) or not 1<=len(manifest['files'])<=3:raise ValueError('invalid signature manifest')
    generation=str(manifest['generation'])
    if not generation.isdigit():raise ValueError('invalid signature generation')
    ROOT.mkdir(exist_ok=True)
    for name,digest in manifest['files'].items():
        if name not in FILES or len(digest)!=64:raise ValueError('invalid signature file')
        target=ROOT/name
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==digest:continue
        pending=ROOT/(name+'.pending')
        try:
            body=client.get_object(Bucket=bucket,Key=f'verified/{generation}/{name}')['Body']
            total=0;hasher=hashlib.sha256()
            with pending.open('wb') as output:
                while chunk:=body.read(1<<20):
                    total+=len(chunk)
                    if total>300<<20:raise ValueError('signature too large')
                    hasher.update(chunk);output.write(chunk)
            if hasher.hexdigest()!=digest:raise ValueError('signature hash mismatch')
            # The .cvd/.cld parser verifies the signature/format before ClamD reload.
            subprocess.run(['sigtool','--info',str(pending)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            pending.replace(target)
        finally:pending.unlink(missing_ok=True)
    keep=set(manifest['files'])
    for name in FILES-keep:(ROOT/name).unlink(missing_ok=True)
    staged=ROOT/'verified.pending';staged.write_text(json.dumps({'verified_at':manifest['verified_at']}));staged.replace(ROOT/'verified.json')
def main():
    from botocore.config import Config
    client=boto3.client('s3',config=Config(connect_timeout=3,read_timeout=10,retries={'max_attempts':1}))
    child=None;last_refresh=0
    try:
        while True:
            if time.monotonic()-last_refresh>=300:
                try:refresh(client,os.environ['SIGNATURE_BUCKET'])
                except Exception:print('signature_refresh_failed',flush=True)
                last_refresh=time.monotonic()
            try:ready=fresh(json.loads((ROOT/'verified.json').read_text())['verified_at'])
            except (OSError,ValueError,KeyError):ready=False
            if not ready:
                if child and child.poll() is None:child.terminate();child.wait(timeout=10)
                child=None
            elif child is None:
                child=subprocess.Popen(['clamd','--config-file=/etc/clamav/clamd.conf'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            elif child.poll() is not None:raise RuntimeError('scanner stopped')
            time.sleep(1)
    finally:
        if child and child.poll() is None:child.terminate();child.wait(timeout=10)
if __name__=='__main__':main()

"""Run on a separately authorized maintenance runner, never on shared EC2.

Run FreshClam with full database validation first. Publish immutable generation
objects, then atomically replace current.json. Role needs only scanner-bucket Put.
"""
import argparse,hashlib,json,pathlib,subprocess,time
import boto3
def main():
    p=argparse.ArgumentParser();p.add_argument('--database-directory',type=pathlib.Path,required=True);args=p.parse_args()
    directory=args.database_directory
    subprocess.run(['freshclam','--datadir='+str(directory)],check=True)
    files=[x for x in directory.iterdir() if x.name in {'main.cvd','daily.cvd','bytecode.cvd','main.cld','daily.cld','bytecode.cld'}]
    assert 2<=len(files)<=3,'expected validated signature databases'
    bases=[f.stem for f in files]
    assert {'main','daily'}<=set(bases) and len(bases)==len(set(bases)),'expected one main and one daily database'
    s3=boto3.client('s3',region_name='ap-south-1');bucket='sapienworx-beta-scanner-signatures-327301848391-ap-south-1';generation=str(int(time.time()))
    manifest={'verified_at':time.time(),'generation':generation,'files':{}}
    for f in files:
        subprocess.run(['sigtool','--info',str(f)],check=True,stdout=subprocess.DEVNULL)
        manifest['files'][f.name]=hashlib.sha256(f.read_bytes()).hexdigest()
        s3.upload_file(str(f),bucket,f'verified/{generation}/{f.name}')
    s3.put_object(Bucket=bucket,Key='verified/current.json',Body=json.dumps(manifest).encode(),ContentType='application/json')
    print('Verified scanner signatures published; no documents processed.')
if __name__=='__main__':main()

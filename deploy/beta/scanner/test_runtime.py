import hashlib,io,json,pathlib,sys,tempfile,time,types,unittest
from unittest.mock import patch
sys.modules.setdefault('boto3',types.ModuleType('boto3'))
import runtime
class Mirror:
    def __init__(self,manifest,data):self.manifest=manifest;self.data=data
    def get_object(self,**kw):
        return {'Body':io.BytesIO(json.dumps(self.manifest).encode() if kw['Key']=='verified/current.json' else self.data)}
class MirrorTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=pathlib.Path(self.tmp.name)
        self.data=b'synthetic signature database'
        self.manifest={'verified_at':time.time(),'generation':'100','files':{'main.cvd':hashlib.sha256(self.data).hexdigest()}}
    def refresh(self):
        with patch.object(runtime,'ROOT',self.root),patch.object(runtime.subprocess,'run') as validate:
            runtime.refresh(Mirror(self.manifest,self.data),'beta-test')
            return validate
    def test_verified_atomic_publication(self):
        self.refresh().assert_called_once()
        self.assertEqual((self.root/'main.cvd').read_bytes(),self.data)
        self.assertTrue((self.root/'verified.json').exists())
    def test_stale_manifest_does_not_start_scanner(self):
        self.manifest['verified_at']=1
        with self.assertRaises(ValueError):self.refresh()
        self.assertFalse((self.root/'verified.json').exists())
    def test_unknown_filename_rejected(self):
        self.manifest['files']={'../../document.pdf':'a'*64}
        with self.assertRaises(ValueError):self.refresh()
    def test_hash_failure_removes_partial_file(self):
        self.manifest['files']['main.cvd']='0'*64
        with self.assertRaises(ValueError):self.refresh()
        self.assertEqual(list(self.root.iterdir()),[])
    def test_empty_manifest_rejected(self):
        self.manifest['files']={}
        with self.assertRaises(ValueError):self.refresh()
if __name__=='__main__':unittest.main()

import importlib.util
from pathlib import Path
import tempfile
import unittest
import base64

spec = importlib.util.spec_from_file_location("prepare_ai", Path(__file__).with_name("prepare-ai-secret.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AISecretTests(unittest.TestCase):
    def response(self,parameter=None):
        return {"Parameters":[parameter or {"Name":"/sapienworx/beta/OPENAI_API_KEY","Type":"SecureString","Value":"unit-test-not-a-valid-provider-key"},{"Name":"/sapienworx/beta/AI_ARTIFACT_ENCRYPTION_KEY","Type":"SecureString","Value":base64.b64encode(bytes(range(32))).decode()}]}
    def test_disabled_private_file_no_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder) / "runtime"
            raw = self.response()
            path = module.prepare(raw, directory)
            self.assertTrue(path.read_text().startswith("AI_ENABLED=false\n"))
            self.assertIn("OPENAI_ENABLED=false\n",path.read_text())
            self.assertIn("AI_ARTIFACT_ENCRYPTION_KEY=",path.read_text())
            with self.assertRaises(FileExistsError):
                module.prepare(raw, directory)

    def test_rejects_wrong_environment_plaintext_or_injected_value(self):
        with tempfile.TemporaryDirectory() as folder:
            for update in [{"Name": "/sapienworx/production/OPENAI_API_KEY"}, {"Type": "String"}, {"Value": "secret\nAI_ENABLED=true"}, {"Value": "${UNTRUSTED_SECRET_VALUE}"}]:
                parameter = {"Name": "/sapienworx/beta/OPENAI_API_KEY", "Type": "SecureString", "Value": "unit-test-not-a-valid-provider-key"}
                parameter.update(update)
                with self.assertRaises(ValueError):
                    module.prepare(self.response(parameter), Path(folder) / "runtime")
            self.assertFalse((Path(folder) / "runtime" / "ai.env").exists())

    def test_missing_or_invalid_artifact_key_cannot_prepare_partial_configuration(self):
        with tempfile.TemporaryDirectory() as folder:
            for value in ["bad","",base64.b64encode(bytes(16)).decode()]:
                raw=self.response();raw['Parameters'][1]['Value']=value
                with self.assertRaises(ValueError):module.prepare(raw,Path(folder)/'runtime')
            with self.assertRaises(ValueError):module.prepare({'Parameter':self.response()['Parameters'][0]},Path(folder)/'runtime')

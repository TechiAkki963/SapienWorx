"""Safety gates for private verification and independent workflow boundaries."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('private', ROOT / 'verify-private-runtime.py')
private = importlib.util.module_from_spec(spec)
spec.loader.exec_module(private)


class RuntimeVerification(unittest.TestCase):
    def exercise(self, defect=None):
        sha = 'a' * 40
        role_keys = {'DATABASE_URL': 'sapienworx_beta_app', 'INTELLIGENCE_DATABASE_URL': 'sapienworx_beta_intelligence', 'MIGRATION_DATABASE_URL': 'sapienworx_beta_migrator'}
        values = {key: f'postgres://{role}:synthetic-pass@beta.test/sapienworx_beta?sslmode=require' for key, role in role_keys.items()}
        values.update(JWT_SECRET='synthetic-jwt', AUTH_OTP_HMAC_SECRET='synthetic-otp', S3_BUCKET='synthetic-bucket')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'runtime').mkdir()
            (root / 'runtime/deployed-sha').write_text(sha)
            (root / 'runtime/beta.env').write_text('\n'.join(f'{k}={v}' for k, v in values.items()))
            def docker(args, **kwargs):
                if args[1] == 'run':
                    return b'001|checksum\n'
                component = args[-1].removeprefix('sapienworx-beta-')
                env = dict(values, APP_ENV='beta', CORS_ALLOWED_ORIGINS='https://beta.sapienworx.com', AUTH_COOKIE_SECURE='true')
                image_sha = 'b' * 40 if defect == 'image' else sha
                return json.dumps([{'State': {'Health': {'Status': 'healthy'}}, 'Config': {'Image': f'123.dkr.ecr.ap-south-1.amazonaws.com/sapienworx-beta/{component}:{image_sha}', 'Env': [f'{k}={v}' for k, v in env.items()]}}]).encode()
            def postgres(image, env, command):
                self.assertEqual(env['PGDATABASE'], 'sapienworx_beta')
                self.assertEqual(env['PGOPTIONS'], '-c default_transaction_read_only=on')
                query = command[-1]
                if 'schema_migrations' in query:
                    return b'001|drift\n' if defect == 'ledger' else b'001|checksum\n'
                isolation = 't' if defect == 'production-access' else 'f'
                return f"sapienworx_beta|{env['PGUSER']}|t|{isolation}|f".encode()
            with patch.object(private, 'ROOT', root), patch.object(private.data, 'parameters', return_value=values), patch.object(private.data, 'aws', return_value=b'{"Account":"123"}'), patch.object(private.data, 'run_postgres', side_effect=postgres), patch.object(private.subprocess, 'check_output', side_effect=docker), patch('sys.stdout', new=io.StringIO()):
                private.verify(sha)

    def test_private_success_without_public_beta(self):
        self.exercise()

    def test_migration_drift_rejected(self):
        with self.assertRaises(ValueError):
            self.exercise('ledger')

    def test_production_access_rejected(self):
        with self.assertRaises(ValueError):
            self.exercise('production-access')

    def test_wrong_container_release_rejected(self):
        with self.assertRaises(ValueError):
            self.exercise('image')

    def test_runtime_stage_does_not_require_or_activate_public_beta(self):
        workflow = (ROOT.parents[1] / '.github/workflows/beta-deploy.yml').read_text()
        health = (ROOT / 'health-check.sh').read_text()
        self.assertNotIn('https://beta.sapienworx.com', workflow + health)
        self.assertNotIn('CONFIRM_EDGE_TRANSITION=', workflow)
        self.assertIn('verify-private-runtime.py {sha}', workflow)
        self.assertIn('verify-public-edge.sh', workflow)


if __name__ == '__main__':
    unittest.main()

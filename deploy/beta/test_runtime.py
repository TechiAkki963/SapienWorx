import copy
import unittest
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("runtime", Path(__file__).with_name("validate-runtime.py"))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)
validate, ROOT = runtime.validate, runtime.ROOT


class RuntimeSafetyTests(unittest.TestCase):
    def setUp(self):
        endpoint = "sapienworx-production-postgres.example.ap-south-1.rds.amazonaws.com"
        self.values = {
            "RDS_ENDPOINT": endpoint,
            "S3_BUCKET": "sapienworx-beta-documents-123456789012-ap-south-1",
            "JWT_SECRET": "a" * 48,
            "AUTH_OTP_HMAC_SECRET": "b" * 48,
        }
        for key, user, password in [("DATABASE_URL", "sapienworx_beta_app", "app-password"),
                                    ("INTELLIGENCE_DATABASE_URL", "sapienworx_beta_intelligence", "worker-password"),
                                    ("MIGRATION_DATABASE_URL", "sapienworx_beta_migrator", "migration-password")]:
            self.values[key] = f"postgres://{user}:{password}@{endpoint}/sapienworx_beta?sslmode=require"

    def response(self, values):
        return {"Parameters": [{"Name": ROOT + k, "Value": v} for k, v in values.items()]}

    def test_accepts_only_isolated_credentials(self):
        self.assertEqual(validate(self.response(self.values)), self.values)

    def test_rejects_production_and_unsafe_values(self):
        cases = [
            ("DATABASE_URL", self.values["DATABASE_URL"].replace("sapienworx_beta", "sapienworx")),
            ("DATABASE_URL", self.values["DATABASE_URL"].replace("production-postgres", "unapproved-postgres")),
            ("DATABASE_URL", self.values["DATABASE_URL"].replace("sslmode=require", "sslmode=disable")),
            ("DATABASE_URL", self.values["DATABASE_URL"] + "&sslmode=disable"),
            ("DATABASE_URL", self.values["DATABASE_URL"] + "&host=production.example"),
            ("DATABASE_URL", self.values["DATABASE_URL"] + "&dbname=sapienworx"),
            ("MIGRATION_DATABASE_URL", self.values["DATABASE_URL"]),
            ("S3_BUCKET", self.values["S3_BUCKET"].replace("beta", "production")),
            ("JWT_SECRET", "$(unsafe)" + "a" * 48),
            ("JWT_SECRET", "a" * 48 + "\n"),
            ("AUTH_OTP_HMAC_SECRET", self.values["JWT_SECRET"]),
        ]
        for key, value in cases:
            with self.subTest(key=key, value_index=cases.index((key, value))):
                values = copy.deepcopy(self.values)
                values[key] = value
                with self.assertRaises(ValueError): validate(self.response(values))

    def test_rejects_missing_parameters(self):
        response = self.response(self.values)
        response["InvalidParameters"] = [ROOT + "DATABASE_URL"]
        with self.assertRaises(ValueError): validate(response)


if __name__ == "__main__":
    unittest.main()

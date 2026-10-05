import unittest
from health import fresh,MAX_AGE
class FreshnessTests(unittest.TestCase):
    def test_stale_signatures_fail_closed(self):
        self.assertFalse(fresh(1,MAX_AGE+2))
    def test_future_manifest_rejected(self):
        self.assertFalse(fresh(101,100))
    def test_current_manifest(self):
        self.assertTrue(fresh(100,100))
if __name__=='__main__':unittest.main()

import unittest

from self_model import SelfModel


class SelfModelTests(unittest.TestCase):
    def test_capability_update(self):
        m = SelfModel()
        m.observe_capability("terminal", True)
        self.assertIn("terminal", m.capabilities)
        m.observe_capability("terminal", False)
        self.assertNotIn("terminal", m.capabilities)
        self.assertIn("terminal", m.limitations)

    def test_belief_revision_reduces_confidence(self):
        m = SelfModel()
        m.update_belief("p", 0.9)
        m.revise_belief("p", 0.5)
        self.assertLess(m.beliefs["p"], 0.9)

    def test_uncertainty_is_bounded(self):
        m = SelfModel()
        m.update_uncertainty("p", 99)
        self.assertEqual(m.uncertainties["p"], 1.0)


if __name__ == "__main__":
    unittest.main()

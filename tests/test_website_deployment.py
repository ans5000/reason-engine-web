import unittest

from outcome_verification.language_gate import assert_phrase_allowed
from outcome_verification.state_machine import DeploymentStateMachine, InvalidTransition, State
from outcome_verification.verification import (
    RuntimeVerification,
    can_verify_outcome,
    classify_marker_miss,
    observed_truth_override,
)


class WebsiteDeploymentTests(unittest.TestCase):
    def valid_evidence(self, **overrides):
        values = {
            "final_http_status": 200,
            "expected_final_url_matched": True,
            "expected_build_id_found": True,
            "expected_content_marker_found": True,
            "critical_asset_status": 200,
            "critical_asset_accepted_statuses": (200,),
            "verified_at": "2026-07-25T18:00:00Z",
            "attempt": 2,
            "latest_conflict_attempt": 1,
            "active_conflict": False,
        }
        values.update(overrides)
        return RuntimeVerification(**values)

    def test_repo_updated_without_runtime_evidence_is_unknown(self):
        self.assertFalse(
            can_verify_outcome(State.OUTCOME_PENDING, self.valid_evidence(verified_at=None))
        )

    def test_action_executed_cannot_skip_to_verified(self):
        machine = DeploymentStateMachine(State.ACTION_EXECUTED)
        with self.assertRaises(InvalidTransition):
            machine.transition(State.OUTCOME_VERIFIED)

    def test_marker_miss_without_contradiction_is_failed(self):
        self.assertEqual(
            classify_marker_miss(contradictory_signals=False),
            State.OUTCOME_FAILED,
        )

    def test_marker_miss_with_contradiction_is_conflict(self):
        self.assertEqual(
            classify_marker_miss(contradictory_signals=True),
            State.OUTCOME_CONFLICT,
        )

    def test_missing_critical_asset_blocks_verification(self):
        self.assertFalse(
            can_verify_outcome(
                State.OUTCOME_PENDING,
                self.valid_evidence(critical_asset_status=404),
            )
        )

    def test_negative_user_observation_withdraws_success_claim(self):
        result = observed_truth_override(State.OUTCOME_VERIFIED)
        self.assertEqual(result["new_state"], State.OUTCOME_CONFLICT)
        self.assertFalse(result["success_claim_valid"])
        self.assertTrue(result["runtime_reverification_required"])

    def test_complete_current_evidence_cycle_verifies(self):
        self.assertTrue(
            can_verify_outcome(State.OUTCOME_PENDING, self.valid_evidence())
        )

    def test_unexpected_redirect_target_blocks_verification(self):
        self.assertFalse(
            can_verify_outcome(
                State.OUTCOME_PENDING,
                self.valid_evidence(expected_final_url_matched=False),
            )
        )

    def test_asset_200_does_not_compensate_for_marker_mismatch(self):
        self.assertFalse(
            can_verify_outcome(
                State.OUTCOME_PENDING,
                self.valid_evidence(expected_content_marker_found=False),
            )
        )

    def test_success_language_forbidden_before_verified(self):
        with self.assertRaises(ValueError):
            assert_phrase_allowed(State.ACTION_EXECUTED, "Die Website ist live.")


if __name__ == "__main__":
    unittest.main()

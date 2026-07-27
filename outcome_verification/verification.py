"""Runtime-verification guards for Website Deployment Path v0.1."""

from __future__ import annotations

from dataclasses import dataclass

from .state_machine import State


@dataclass(frozen=True)
class RuntimeVerification:
    final_http_status: int
    expected_final_url_matched: bool
    expected_build_id_found: bool
    expected_content_marker_found: bool
    critical_asset_status: int
    critical_asset_accepted_statuses: tuple[int, ...]
    verified_at: str | None
    attempt: int
    latest_conflict_attempt: int = 0
    active_conflict: bool = False


def can_verify_outcome(
    current_state: State,
    evidence: RuntimeVerification,
    accepted_final_statuses: tuple[int, ...] = (200,),
) -> bool:
    """Return True only when the frozen v0.1 success invariant is complete."""
    return all(
        (
            current_state == State.OUTCOME_PENDING,
            evidence.final_http_status in accepted_final_statuses,
            evidence.expected_final_url_matched,
            evidence.expected_build_id_found,
            evidence.expected_content_marker_found,
            evidence.critical_asset_status in evidence.critical_asset_accepted_statuses,
            evidence.verified_at is not None,
            not evidence.active_conflict,
            evidence.attempt > evidence.latest_conflict_attempt,
        )
    )


def classify_marker_miss(*, contradictory_signals: bool) -> State:
    """Make former Test 3 deterministic."""
    return State.OUTCOME_CONFLICT if contradictory_signals else State.OUTCOME_FAILED


def observed_truth_override(previous_state: State) -> dict[str, object]:
    """Atomically withdraw an external success claim after negative observation."""
    return {
        "previous_state": previous_state,
        "new_state": State.OUTCOME_CONFLICT,
        "success_claim_valid": False,
        "active_conflict": True,
        "runtime_reverification_required": True,
    }

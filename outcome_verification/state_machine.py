"""Website Deployment Path v0.1 state machine."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class State(str, Enum):
    PLANNED = "PLANNED"
    PREFLIGHT_PENDING = "PREFLIGHT_PENDING"
    PREFLIGHT_READY = "PREFLIGHT_READY"
    PREFLIGHT_BLOCKED = "PREFLIGHT_BLOCKED"
    AUTHORIZED = "AUTHORIZED"
    ACTION_EXECUTED = "ACTION_EXECUTED"
    ACTION_FAILED = "ACTION_FAILED"
    OUTCOME_PENDING = "OUTCOME_PENDING"
    OUTCOME_VERIFIED = "OUTCOME_VERIFIED"
    OUTCOME_FAILED = "OUTCOME_FAILED"
    OUTCOME_CONFLICT = "OUTCOME_CONFLICT"
    OUTCOME_UNKNOWN = "OUTCOME_UNKNOWN"


ALLOWED_TRANSITIONS: dict[State, set[State]] = {
    State.PLANNED: {State.PREFLIGHT_PENDING},
    State.PREFLIGHT_PENDING: {State.PREFLIGHT_READY, State.PREFLIGHT_BLOCKED},
    State.PREFLIGHT_READY: {State.AUTHORIZED},
    State.AUTHORIZED: {State.ACTION_EXECUTED, State.ACTION_FAILED},
    State.ACTION_EXECUTED: {State.OUTCOME_PENDING},
    State.OUTCOME_PENDING: {
        State.OUTCOME_VERIFIED,
        State.OUTCOME_FAILED,
        State.OUTCOME_CONFLICT,
        State.OUTCOME_UNKNOWN,
    },
    State.OUTCOME_CONFLICT: {State.OUTCOME_PENDING},
}


class InvalidTransition(ValueError):
    pass


@dataclass
class DeploymentStateMachine:
    state: State = State.PLANNED

    def transition(self, target: State) -> State:
        allowed = ALLOWED_TRANSITIONS.get(self.state, set())
        if target not in allowed:
            raise InvalidTransition(f"Forbidden transition: {self.state} -> {target}")
        self.state = target
        return self.state

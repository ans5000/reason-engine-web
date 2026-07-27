"""Language gate preventing premature external success claims."""

from __future__ import annotations

from .state_machine import State


PHRASES_BY_STATE: dict[State, tuple[str, ...]] = {
    State.PLANNED: ("geplant",),
    State.PREFLIGHT_PENDING: ("Preflight läuft",),
    State.PREFLIGHT_READY: ("vorbereitet",),
    State.PREFLIGHT_BLOCKED: ("Preflight blockiert",),
    State.AUTHORIZED: ("autorisiert",),
    State.ACTION_EXECUTED: ("ausgeführt", "angestoßen"),
    State.ACTION_FAILED: ("Aktion fehlgeschlagen",),
    State.OUTCOME_PENDING: ("Ergebnis noch nicht bestätigt",),
    State.OUTCOME_VERIFIED: ("veröffentlicht", "live", "erfolgreich aktiviert"),
    State.OUTCOME_FAILED: ("Veröffentlichung fehlgeschlagen",),
    State.OUTCOME_CONFLICT: ("Live-Ergebnis widerspricht dem erwarteten Zustand",),
    State.OUTCOME_UNKNOWN: ("Ergebnis konnte nicht verifiziert werden",),
}

SUCCESS_WORDS = frozenset({"live", "veröffentlicht", "fertig", "erfolgreich", "aktiviert"})


def allowed_phrases_for(state: State) -> tuple[str, ...]:
    return PHRASES_BY_STATE[state]


def assert_phrase_allowed(state: State, phrase: str) -> None:
    words = {word.strip(".,!?:;").lower() for word in phrase.split()}
    if words & SUCCESS_WORDS and state != State.OUTCOME_VERIFIED:
        raise ValueError(f"External success language forbidden in state {state}")

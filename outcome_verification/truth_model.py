"""Truth domains and evidence-cycle model for website deployment verification."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class TruthDomain(str, Enum):
    REPOSITORY = "repository"
    DEPLOYMENT = "deployment"
    RUNTIME = "runtime"
    OBSERVED = "observed"


class TruthStatus(str, Enum):
    UNKNOWN = "UNKNOWN"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    CONTRADICTED = "CONTRADICTED"


@dataclass(frozen=True)
class Evidence:
    domain: TruthDomain
    status: TruthStatus
    attempt: int
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class EvidenceLedger:
    entries: list[Evidence] = field(default_factory=list)

    def record(self, evidence: Evidence) -> None:
        self.entries.append(evidence)

    def latest_attempt(self, status: TruthStatus | None = None) -> int:
        candidates = [entry.attempt for entry in self.entries if status is None or entry.status == status]
        return max(candidates, default=0)

    @property
    def active_conflict(self) -> bool:
        latest_conflict = max(
            (entry.attempt for entry in self.entries if entry.status == TruthStatus.CONTRADICTED),
            default=0,
        )
        latest_verified = max(
            (entry.attempt for entry in self.entries if entry.status == TruthStatus.VERIFIED),
            default=0,
        )
        return latest_conflict >= latest_verified and latest_conflict > 0

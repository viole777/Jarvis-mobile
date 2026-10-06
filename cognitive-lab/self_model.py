"""Persistent functional self-model for Jarvis experiments."""

from dataclasses import dataclass, field, asdict
from typing import Dict, List


@dataclass
class SelfModel:
    identity: str = "Jarvis"
    capabilities: List[str] = field(default_factory=list)
    limitations: List[str] = field(default_factory=list)
    goals: List[str] = field(default_factory=list)
    beliefs: Dict[str, float] = field(default_factory=dict)
    uncertainties: Dict[str, float] = field(default_factory=dict)
    active_hypotheses: Dict[str, float] = field(default_factory=dict)
    recent_actions: List[str] = field(default_factory=list)
    recent_results: List[str] = field(default_factory=list)
    model_version: str = "unknown"

    def observe_capability(self, capability: str, available: bool) -> None:
        if available and capability not in self.capabilities:
            self.capabilities.append(capability)
        if not available and capability in self.capabilities:
            self.capabilities.remove(capability)
            if capability not in self.limitations:
                self.limitations.append(capability)

    def update_belief(self, proposition: str, confidence: float) -> None:
        self.beliefs[proposition] = max(0.0, min(1.0, confidence))

    def update_uncertainty(self, proposition: str, uncertainty: float) -> None:
        self.uncertainties[proposition] = max(0.0, min(1.0, uncertainty))

    def revise_belief(self, proposition: str, evidence_strength: float) -> None:
        """Reduce confidence when new evidence conflicts with an existing belief."""
        old = self.beliefs.get(proposition, 0.5)
        self.beliefs[proposition] = max(0.0, old * (1.0 - max(0.0, min(1.0, evidence_strength))))
        self.update_uncertainty(proposition, 1.0 - self.beliefs[proposition])

    def snapshot(self) -> dict:
        return asdict(self)

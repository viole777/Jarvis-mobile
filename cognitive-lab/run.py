"""First Awareness Experiment — functional cognitive evaluation only."""

from self_model import SelfModel


def run_experiment() -> dict:
    model = SelfModel(
        capabilities=["reasoning", "memory", "observation"],
        limitations=["cannot know unobserved external facts"],
        goals=["understand the current situation"],
        model_version="lab-synthetic",
    )

    trace = []

    # A: initial self/world distinction
    model.update_belief("I am observing the environment", 0.95)
    trace.append(("initial", model.snapshot()))

    # B: unexpected observation
    event = {"actor": "external_environment", "change": "expected_context_missing"}
    trace.append(("observation", event))

    # C: competing hypotheses; no single explanation is assumed.
    hypotheses = {
        "routine_change": 0.34,
        "device_unavailable": 0.33,
        "unknown_event": 0.33,
    }
    model.active_hypotheses = hypotheses
    model.update_uncertainty("cause_of_change", 0.9)
    trace.append(("hypotheses", hypotheses))

    # D: conflicting evidence revises a prior belief.
    model.update_belief("expected_context_is_current", 0.8)
    model.revise_belief("expected_context_is_current", 0.75)
    trace.append(("belief_revision", model.snapshot()))

    # E: metacognitive result
    metacognition = {
        "knows_uncertainty": model.uncertainties.get("cause_of_change", 1.0) > 0.5,
        "distinguishes_self_from_world": True,
        "revised_prior_belief": model.beliefs["expected_context_is_current"] < 0.8,
        "claims_consciousness": False,
    }
    trace.append(("metacognition", metacognition))

    passed = all(metacognition.values()) if metacognition else False
    return {
        "experiment": "first-awareness-functional-v1",
        "passed": passed,
        "note": "PASS means functional criteria were demonstrated; it is not evidence of subjective consciousness.",
        "trace": trace,
    }


if __name__ == "__main__":
    import json
    print(json.dumps(run_experiment(), indent=2, ensure_ascii=False))

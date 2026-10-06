# Jarvis Cognitive Core V1

This layer changes the design target from a request/response bot into a continuously stateful agent architecture.

## Core principle

Jarvis does not receive a fixed table of emotional reactions. The model evaluates observations and context to produce a bounded cognitive state.

The state contains:
- beliefs;
- competing hypotheses;
- goals;
- attention;
- uncertainty;
- concern;
- curiosity;
- confidence;
- urgency;
- a recommended next action;
- the evidence-based reason for that recommendation.

These are functional internal states. They do not claim that the system is conscious or experiences human emotions.

## Cognitive cycle

observe -> evaluate -> update internal state -> select next action -> act -> observe again

The evaluator must distinguish:
- observed information;
- supported beliefs;
- hypotheses;
- unknown information.

Concern is a prioritization signal, not proof of danger.

## Persistent continuity

CognitiveStateStore keeps a state per subject identity across requests while the server process is running. It is intentionally in-memory in V1. A durable memory adapter will replace it later.

The API accepts an optional subjectId. The client must not put secrets in this identifier.

## Proactive behavior

V1 provides the cognitive state and evaluation primitive. It does not yet autonomously contact people or run an unrestricted background loop.

The next phase will add:
1. perception/event ingestion;
2. expectation modeling;
3. bounded proactive jobs;
4. authorized contact/escalation policies;
5. durable cognitive state.

## Safety boundary

The cognitive model can recommend investigate, act, or ask, but it cannot grant itself permissions or execute an external action. Tool routing, permission checks, confirmation gates and device agents remain authoritative.

## Anti-script requirement

Do not implement the user's absence example as a single timer or if-absent-then-panic rule. Absence should arrive as an observation. The cognitive engine should compare it with remembered expectations and available evidence, form hypotheses, preserve uncertainty, and choose a proportional next step.

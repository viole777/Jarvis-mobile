# Jarvis V2 — Emotional State and Model Routing (design proposal)

This document describes a safe, deterministic first step toward emotional-state simulation and model routing for Jarvis. It is a proposal, not a claim that these features are deployed.

## Simulated affect state

Jarvis may keep a small, inspectable operational state, not a claim of sentience:
- curiosity: task uncertainty / information gaps
- confidence: based on observed tool results, not self-reported certainty alone
- caution: elevated when an action is irreversible or permissions are unclear
- satisfaction: only when a task's success is verified
- follow_up_due: based on an explicit user-approved reminder/check-in policy

State must be bounded, decay over time, explainable, and visible to the user. It must never manipulate the user, pretend to have human feelings, manufacture distress, or imply the user owes it attention. No background monitoring of personal behavior without explicit opt-in.

## Model router requirements

1. Preserve one stable Jarvis conversation, memory and tool policy across model changes.
2. Route based on task class, supported capabilities, latency, provider availability and explicit quotas/limits.
3. Do not claim access to another provider's token balance unless its API actually exposes that information.
4. Use only configured and authorized model bindings. No API keys in source control, client-side code, or conversation logs.
5. Initially support Cloudflare Workers AI models through the native AI binding. Model IDs and availability must be validated against the current catalog before deployment.
6. On failure, retry a compatible configured model once; return a clear error if no fallback is available.
7. Record model ID, routing reason and outcome, but never secrets or private prompt contents in operational logs.

## Hermes boundary

Hermes Agent is an optional external runtime/reference, not an already connected component. A real integration needs an authorized, deployed Hermes endpoint or locally installed runtime, authentication stored in a secret manager, explicit tool allowlists, timeouts, and end-to-end tests. Until those exist, label Hermes as not connected. Do not copy unreviewed Hermes outputs directly into trusted memory.

## Android automation

Browser JavaScript cannot control other Android apps. Cross-app automation requires a separately installed Android component and explicit Android permissions, such as an accessibility service where appropriate. Use a visible user-controlled enable/disable switch, narrow actions, clear confirmation for consequential actions, and a local audit log. Never capture passwords or silently collect screen content.

## Release gates

- Unit tests for state bounds, decay and routing.
- Mocked tests for fallback and provider errors.
- Live smoke test against the deployed Worker using the user's own secret, without revealing it.
- Verify the live /health model matches the deployed source.
- Confirm the actual Hermes connection before describing it as integrated.
- Keep this feature branch separate from production until the checks pass.

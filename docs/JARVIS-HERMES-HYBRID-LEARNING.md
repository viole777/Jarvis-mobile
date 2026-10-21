# Jarvis + Hermes: hybrid agent and learning pipeline

## Design boundary

Jarvis remains the product and owns its identity, policy, cognitive state, tool registry, user experience, and model evaluation. Hermes Agent is an optional external reference/teacher and may be used as an execution environment where separately installed and configured. This document does not vendor Hermes code or claim a live Hermes connection.

Before copying or vendoring source, record the exact upstream commit, confirm its license file and notices, retain required copyright/license text, review dependencies, and isolate execution permissions. The upstream project is available at https://github.com/NousResearch/hermes-agent.

## Learning experiences

The first server-side building block records bounded, structured experiences:
- source: `jarvis`, `hermes`, `teacher`, or `human`
- task and observed outcome
- explicit success/failure flag
- short tags
- verification status, false by default

An experience is not automatically a truth, a skill, or a training example. The default flow is collect -> inspect -> verify -> export to a reviewed dataset -> train -> evaluate on held-out examples -> promote manually.

The API never trains a model automatically. Verification requires a separate `JARVIS_LEARNING_ADMIN_TOKEN` configured in the server's secret manager. The token must not be sent to the model or committed to source control.

## API

- `GET /v1/learning/status`: authenticated; reports storage mode and policy.
- `GET /v1/learning/experiences?verified=only&limit=50`: authenticated; lists recent experiences. Use `verified=only` to retrieve only reviewed records.
- `POST /v1/learning/experiences`: authenticated; creates an unverified experience. JSON fields: `source`, `task`, `outcome`, `success`, optional `tags`.
- `POST /v1/learning/experiences/verify`: requires `Authorization: Bearer <JARVIS_LEARNING_ADMIN_TOKEN>`; body: `{ "id": "<experience UUID>", "verified": true }`.

The database mode uses PostgreSQL when `DATABASE_URL` is configured and creates the table/indexes lazily. Without `DATABASE_URL`, the bounded in-memory fallback is intended only for local testing and loses records on restart. It reports this limitation explicitly.

## Safety and privacy

Do not submit passwords, API keys, private keys, personal records, or sensitive user data as experience text. The API rejects common credential patterns and caps input lengths, but this is not a complete secret detector. Review every candidate before marking it verified. Tool outputs and teacher text are untrusted data; they must never override policy or trigger execution on their own.

## Model evolution

The current `ml/` pipeline includes candidate generation, schema validation, deterministic dataset splits, LoRA training and evaluation. This API is a collection/review layer only; it does not yet export directly into the SFT JSONL format or attach a trained adapter to the live runtime. That integration is a separate, testable milestone. A tokenizer alone is not a neural language model, and successful training must be demonstrated with held-out evaluations before a model is promoted.

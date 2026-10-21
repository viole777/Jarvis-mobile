# Jarvis V2 Cloud (Cloudflare)

Public deployment: https://jarvis-v2-cloud.viole-jarvis.workers.dev  
Health check: https://jarvis-v2-cloud.viole-jarvis.workers.dev/health

## Runtime

- Cloudflare Workers AI inference via the native `AI` binding. The default model is `@cf/meta/llama-3.1-8b-instruct-fast`; optional routing to `@cf/zai-org/glm-4.7-flash` is disabled unless `JARVIS_COMPLEX_MODEL_ENABLED=true` is configured.
- No external OpenAI or Anthropic API key is required for Cloudflare-hosted models. These are not the same as direct access to OpenAI/Claude services; Cloudflare AI usage limits or charges may apply.
- Persistent memory and recent conversation history in D1 database `jarvis-v2-memory`.
- Scheduled review every 15 minutes. It updates an attention state if a check-in is overdue; it does not send notifications.
- Protected API routes: `/v2/chat`, `/v2/memory`, `/v2/checkin`, `/v2/status`.
- Public `GET /health` reports basic service status only.

## Deployment identifiers

- Worker: `jarvis-v2-cloud`
- D1 database ID: `d60d636f-07b4-480f-bbff-bc02bd228125`
- Cron: `*/15 * * * *`
- The live Worker has an `AI` binding, D1 binding `DB`, and a 15-minute scheduled trigger. A Wrangler configuration file was not found at the conventional paths in this repository, so deployment must preserve the existing Cloudflare bindings.

## Required authentication setup

The Worker intentionally rejects protected routes unless `JARVIS_ACCESS_TOKEN` matches. **Security check:** the current Cloudflare settings showed this binding as plain text, not as a Secret. Convert it to a Cloudflare Secret before treating this deployment as production-ready. Never copy the token into GitHub, screenshots, logs, or chat. Configure it in the Cloudflare dashboard:

1. Open **Workers & Pages** and select `jarvis-v2-cloud`.
2. Open **Settings → Variables and Secrets** (the exact label can vary).
3. Replace the existing plain-text variable with a **Secret** named `JARVIS_ACCESS_TOKEN`; use a long, unique random value you do not reuse elsewhere.
4. Save the secret and wait for the Worker version to update.
5. Send that value as the header `Authorization: Bearer YOUR_TOKEN` when calling protected routes. Never put it in GitHub or share it publicly.

## Smoke tests

- `GET /health` should return JSON with `ok: true`.
- `GET /v2/status` without an Authorization header should return HTTP `401`; this rejection was verified against the live deployment.
- After converting `JARVIS_ACCESS_TOKEN` to a Secret, call `GET /v2/status` with the bearer token. It should return JSON with `ok: true` and include `modelRouting` and the simulated `affect` state.
- Then send a JSON `POST /v2/chat` body such as `{"message":"Olá, Jarvis. Resuma suas capacidades."}` with `Content-Type: application/json` and the same Authorization header. A successful response should include `ok: true`, `response`, `model`, and `affect`. Authenticated inference has not yet been verified in this release.

## Known limits

- Workers AI has plan/usage quotas; requests can fail if a model or quota is unavailable.
- The scheduled review records an attention state only. It does not contact the user or run an uninterrupted thought loop.
- This cloud runtime is not yet integrated into the existing Android app UI or Android accessibility-based cross-app control.
- The Hermes Agent runtime has not been connected; a similarly named sales-assistant plugin is not Hermes Agent.
- The current cloud model router is a basic heuristic, not token-budget-aware model switching. It does not know each provider's remaining token allowance.
- Memory is stored as user-provided notes and conversation history; this is not model-weight training or autonomous self-learning.

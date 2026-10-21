# Jarvis V2 Cloud (Cloudflare)

Public deployment: https://jarvis-v2-cloud.viole-jarvis.workers.dev  
Health check: https://jarvis-v2-cloud.viole-jarvis.workers.dev/health

## Runtime

- Cloudflare Workers AI inference via the native `AI` binding. The default model is `@cf/meta/llama-3.1-8b-instruct-fast`; routing to `@cf/zai-org/glm-4.7-flash` is enabled by default for complex requests and can be disabled with `JARVIS_COMPLEX_MODEL_ENABLED=false`.
- No external OpenAI or Anthropic API key is required for Cloudflare-hosted models. These are not the same as direct access to OpenAI/Claude services; Cloudflare AI usage limits or charges may apply.
- Persistent memory and recent conversation history in D1 database `jarvis-v2-memory`.
- Scheduled review every 15 minutes. It updates the attention state and creates a persistent `Revisar check-in` task when the check-in threshold is overdue. This is an in-app task queue, not a push notification.
- Protected API routes: `/v2/chat`, `/v2/memory`, `/v2/checkin`, `/v2/status`, `/v2/tasks` (GET/POST), `/v2/tasks/:id` (PATCH), `/v1/agent` (Android tool-planning endpoint), and `/v2/hermes/execute` (optional bridge).\n- `/v1/chat/completions` is an OpenAI-compatible proxy for the Hermes runtime. It requires the separate Cloudflare Secret binding `HERMES_MODEL_PROXY_SECRET`; it is deliberately unavailable until that secret is configured.
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
3. Add a **Secret** named `JARVIS_ACCESS_TOKEN_SECRET` with a long, unique random value. The current source prefers this secret binding; it temporarily supports the legacy `JARVIS_ACCESS_TOKEN` variable during migration. Use the same token in the web UI.
4. Save the secret and wait for the Worker version to update.
5. Deploy the latest `cloudflare/jarvis-v2/src/index.js` source, then send the secret value as `Authorization: Bearer YOUR_TOKEN` when calling protected routes. Never put it in GitHub or share it publicly.

## Smoke tests

- `GET /health` should return JSON with `ok: true`.
- `GET /v2/status` without an Authorization header should return HTTP `401`; this rejection was verified against the live deployment.
- After adding `JARVIS_ACCESS_TOKEN_SECRET` as a Secret and deploying the latest source, call `GET /v2/status` with the bearer token. It should return JSON with `ok: true` and include `modelRouting` and the simulated `affect` state.
- Then send a JSON `POST /v2/chat` body such as `{"message":"Olá, Jarvis. Resuma suas capacidades."}` with `Content-Type: application/json` and the same Authorization header. A successful response should include `ok: true`, `response`, `model`, and `affect`. Authenticated inference has not yet been verified in this release.

## New API behavior\n\n- `GET /v2/tasks` lists persistent tasks. `POST /v2/tasks` accepts `{\"title\":\"...\",\"detail\":\"...\",\"dueAt\":\"ISO timestamp\"}`. `PATCH /v2/tasks/:id` accepts `status` equal to `pending`, `completed`, or `cancelled`.\n- The scheduled agent creates at most one pending `Revisar check-in` reminder task. It is visible through the authenticated tasks API; browser/mobile push delivery is not implemented.\n- `POST /v2/hermes/execute` accepts `{\"message\":\"...\"}` and forwards it to the configured HTTPS `HERMES_AGENT_URL`. The expected upstream response may contain `response`, `output`, `text`, or `message`.\n- `POST /v1/agent` accepts the Android app's `messages` and `tools` payload, returns `{text, toolCalls, isFinal}`, and uses Workers AI rather than an external provider API key. The app still needs the Worker bearer token; the Android Safety Engine remains responsible for action confirmations.\n- GitHub Actions now runs `node --check` for the Cloudflare Worker source on relevant pushes and pull requests.\n\n## Known limits

- Workers AI has plan/usage quotas; requests can fail if a model or quota is unavailable.
- The scheduled review runs every 15 minutes and can queue a persistent reminder task, but it does not send push notifications or run an uninterrupted model thought loop.
- This cloud runtime is not yet integrated into the existing Android app UI or Android accessibility-based cross-app control.
- Hermes bridge endpoint: `POST /v2/hermes/execute` forwards an OpenAI-compatible chat request to `HERMES_AGENT_URL` over HTTPS and uses `HERMES_AGENT_TOKEN`. The bridge remains unavailable until an actual Hermes runtime is deployed and both bindings are configured. The model proxy also needs the `HERMES_MODEL_PROXY_SECRET` Secret binding; do not expose that route without authentication.
- Model routing now reserves an estimated token allowance atomically in D1 before calling the complex model, reconciles the reservation after inference, and releases it on fallback/failure. `JARVIS_COMPLEX_DAILY_TOKEN_BUDGET` defaults to 60,000 estimated tokens/day; the limit is clamped to 1,000–2,000,000. Requests that cannot reserve their full prompt + output allowance fall back to the fast model. `/v2/status` exposes `modelBudget` with the daily limit and estimated remaining tokens. This may reduce surprise usage but is not a hard provider billing limit: token counts are character-based estimates, not provider-reported usage.
- Memory is stored as user-provided notes and conversation history; this is not model-weight training or autonomous self-learning.

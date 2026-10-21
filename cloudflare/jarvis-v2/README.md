# Jarvis V2 Cloud (Cloudflare)

Public deployment: https://jarvis-v2-cloud.viole-jarvis.workers.dev  
Health check: https://jarvis-v2-cloud.viole-jarvis.workers.dev/health

## Runtime

- Cloudflare Workers AI inference via the native `AI` binding, model `@cf/meta/llama-3.1-8b-instruct`; no third-party AI-provider API key is needed.
- Persistent memory and recent conversation history in D1 database `jarvis-v2-memory`.
- Scheduled review every 15 minutes. It updates an attention state if a check-in is overdue; it does not send notifications.
- Protected API routes: `/v2/chat`, `/v2/memory`, `/v2/checkin`, `/v2/status`.
- Public `GET /health` reports basic service status only.

## Deployment identifiers

- Worker: `jarvis-v2-cloud`
- D1 database ID: `d60d636f-07b4-480f-bbff-bc02bd228125`
- Cron: `*/15 * * * *`
- Wrangler config already points to the deployed D1 database.

## Required authentication setup

The Worker intentionally rejects all protected routes until a secret exists. Configure it in the Cloudflare dashboard:

1. Open **Workers & Pages** and select `jarvis-v2-cloud`.
2. Open **Settings → Variables and Secrets** (the exact label can vary).
3. Add a **Secret** named `JARVIS_ACCESS_TOKEN`; use a long, unique random value that you do not reuse anywhere else.
4. Save the secret and wait for the Worker version to update.
5. Send that value as the header `Authorization: Bearer YOUR_TOKEN` when calling protected routes. Never put it in GitHub or share it publicly.

## Smoke tests

- `GET /health` should return JSON with `ok: true`.
- `GET /v2/status` without an Authorization header should return HTTP `401`; that rejection was verified against the live deployment.
- After configuring `JARVIS_ACCESS_TOKEN`, call `GET /v2/status` with the bearer token. It should return JSON with `ok: true`.
- Then send a JSON `POST /v2/chat` body such as `{"message":"Olá, Jarvis. Resuma suas capacidades."}` with `Content-Type: application/json` and the same Authorization header. A successful response should include `ok: true` and `response`. This authenticated inference test remains pending until the secret is configured.

## Known limits

- Workers AI has plan/usage quotas; requests can fail if a model or quota is unavailable.
- The scheduled review records an attention state only. It does not contact the user or run an uninterrupted thought loop.
- This cloud runtime is not yet integrated into the existing Android app UI.
- Memory is stored as user-provided notes and conversation history; this is not model-weight training or autonomous self-learning.

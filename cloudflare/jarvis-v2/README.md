# Jarvis V2 Cloud (Cloudflare)

This is an isolated cloud runtime; it does not replace the existing Node/Android app yet.

## Capabilities
- Cloudflare Workers AI inference through the `AI` binding (no third-party model API key in Jarvis).
- Persistent memory and short conversation history in D1.
- A scheduled review every 15 minutes. It updates an attention state when the configured check-in interval is overdue.
- Authenticated API routes: `/v2/chat`, `/v2/memory`, `/v2/checkin`, `/v2/status`.
- Public `/health` endpoint only reveals service health and configured model, not user data.

## Important limits
- Workers AI has plan/usage quotas and can return errors when a model is unavailable or the quota is exhausted.
- The scheduled review records an attention state; it does not send a notification. A notification channel must be separately configured and authorized.
- The agent does not run an uninterrupted thought loop. Scheduled events and incoming requests trigger work.
- The access token must be stored as a Cloudflare Worker secret named `JARVIS_ACCESS_TOKEN`. Never commit it.
- This service has not yet been integrated into the current Android UI.

## Deploy
1. Create a D1 database named `jarvis-v2-memory`.
2. Replace `REPLACE_AFTER_CREATE` in `wrangler.jsonc` with its ID.
3. Configure the `AI` binding and `DB` binding, plus secret `JARVIS_ACCESS_TOKEN`.
4. Deploy with Wrangler and verify `GET /health`.
5. Call authenticated routes with `Authorization: Bearer <token>`.

The runtime initializes its tables on first authenticated request or scheduled event.

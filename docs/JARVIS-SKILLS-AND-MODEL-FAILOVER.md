# Jarvis skills and automatic model failover

## Add a skill

1. Create `server/skills/<skill-id>/SKILL.md`; use a lowercase folder ID containing letters, digits, and hyphens.
2. Write a short Markdown instruction file (maximum 20 KB). Include purpose, workflow, verification, and permission boundaries.
3. Commit and deploy the backend. Do not put credentials in a skill.
4. List skills using authenticated `GET /v1/skills`.
5. Select skills in an authenticated `POST /v1/agent` request by sending an array such as `"skills":["create-skill"]` alongside `messages` and optional `tools`.

Only up to eight requested skills are loaded per request. Skills are guidance, not permissions. The server explicitly warns the model to treat skill text as untrusted instructions; the tool executor must still enforce authorization and confirmation independently.

## Automatic model fallback

Set `JARVIS_MODEL_FALLBACKS` in the backend environment as a JSON array. Example:

```json
[
  {
    "model": "backup-model-id",
    "baseUrl": "https://backup-provider.example/v1",
    "apiKeyEnv": "BACKUP_AI_API_KEY"
  }
]
```

Then create `BACKUP_AI_API_KEY` as a separate server-side secret. Never commit its value. The primary model is tried first; on HTTP 429 or recognized quota/context/token-limit errors, the backend tries configured fallback entries in order. The response includes `model` and `fallbackUsed` so the caller can show which model answered.

Important limits:
- A different model on the same exhausted account/key may not help. Use a fallback provider or credential with available quota.
- The server cannot automatically create credits or bypass provider billing limits.
- This is request-level failover, not token pooling across unrelated accounts. Context-length errors can be retried with a fallback model, but the current version does not summarize the conversation automatically.
- Only HTTPS fallback endpoints are accepted by the environment parser.
- Configure a small fallback chain and provider spending limits to avoid unexpected costs.

## Current scope

This commit adds a server-side skill registry, two starter skills, an authenticated skills-list endpoint, skill injection into `/v1/agent`, and model failover. It does not yet grant the model direct GitHub/Render/Vercel/Neon permissions or complete the Android voice/device integration. Those need separate adapters, least-privilege credentials, and confirmation gates.
# Jarvis V1 — AIsa setup and safe deployment

This guide configures AIsa as the model provider for the existing Jarvis backend. The AIsa API key is a server-side secret; never place it in this repository, browser JavaScript, Android resources, or a client-side environment variable.

## 0. Rotate any exposed key

If an API key was pasted into a chat, issue, commit, screenshot, or public place, revoke it in the AIsa dashboard and create a replacement. Do not reuse the exposed key.

## 1. Configure server environment variables

In the backend hosting provider's **server-side environment / secrets** settings, set:

- `AISA_API_KEY`: a newly generated AIsa API key.
- `AISA_BASE_URL`: `https://api.aisa.one/v1`.
- `AISA_MODEL`: a model ID currently supported and enabled for your account. Check the AIsa model marketplace/pricing page; don't assume every example model is available.
- `JARVIS_AUTH_TOKEN`: a separate, long, random access token for Jarvis clients. Do not use the AIsa key here.
- `JARVIS_CORS_ORIGIN`: the exact HTTPS origin serving Jarvis, if applicable.

Use the host's secret manager; do not commit real values to `.env.example` or Git. Redeploy/restart the service after adding variables.

## 2. Configure from a Jarvis prompt

First configure the separate `JARVIS_AUTH_TOKEN` once using **Configurar acesso**. Then send a message in this form:

```text
Configurar AIsa: YOUR_NEW_API_KEY
```

The browser recognizes this setup intent and intercepts it before adding it to chat history or sending it to the LLM. After confirmation, it sends the key over HTTPS to the authenticated `POST /v1/setup/aisa` endpoint. If `AISA_MODEL` is not already configured, Jarvis asks for the exact model ID enabled for your AIsa account.

**Runtime limitation:** this prompt flow stores the key only in server process memory, not in GitHub or browser storage. It is lost when the server restarts/redeploys. For durable configuration, put the key in the hosting provider's secret manager as `AISA_API_KEY`. The prompt flow does not automatically change Render/Vercel environment variables because that requires a separately authorized hosting-provider integration.

You can also open **Configurar acesso** to set the separate `JARVIS_AUTH_TOKEN`; never paste the AIsa key into that field.

## 3. Test

- Open `/health`. It reports whether the model settings are present, but never returns credentials.
- The setup endpoint is protected by `JARVIS_AUTH_TOKEN`, rate-limited, and does not log the submitted key. It configures the running process only.
- Send a simple message in the browser. The backend calls `POST https://api.aisa.one/v1/chat/completions` using the selected model.
- The Android `HttpModelClient` uses `POST /v1/agent`; AIsa function/tool calls are converted to the OpenAI-compatible schema and returned to the Android agent loop.
- Check server logs for HTTP status and configuration errors. Logs intentionally do not print request headers or API keys.

The backend applies a request-body limit, a per-IP request limit, a bounded message history, and a 45-second provider timeout. API calls may incur charges. Set a key quota/spending limit in AIsa and test with short prompts first.

## 4. Tools and Skills boundaries

The model gateway supports OpenAI-compatible tool/function-call formatting for tools supplied by the Android agent. The Android app's local tool registry and Safety Engine remain responsible for actually executing those device actions and asking for confirmation when required.

AIsa's separate Skills marketplace and MCP tools are **not automatically enabled** merely by configuring the LLM API. Do not claim a Skill ran unless it was explicitly configured, invoked, and its result checked. Before connecting AIsa Skills/MCP, choose the specific skill categories needed and review their permissions, data access, and any per-call charges. Do not allow arbitrary paid API calls, purchases, messages, or deletion actions to run without explicit confirmation.

## 5. Known V1 limitations

- The web chat is text-only for model inference in this first integration; existing browser voice controls use browser speech capabilities.
- Browser image and screen previews are not sent to the model in this version.
- The cognitive state endpoint is separate from the LLM and does not mean the model has persistent learned parameters.
- Chat history is held in the current page session; durable server-side conversation storage is not implemented here.
- AIsa Skills/MCP discovery and invocation require a separate, explicitly configured integration and are not represented as complete by this setup.

## API reference

AIsa's documented OpenAI-compatible endpoint is `https://api.aisa.one/v1/chat/completions`. See the official [Getting Started guide](https://docs.aisa.one/docs/getting-started-with-aisa) and [model marketplace/pricing](https://marketplace.aisa.one/pricing).

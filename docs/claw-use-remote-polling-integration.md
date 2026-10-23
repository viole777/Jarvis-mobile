# Jarvis ↔ Claw Use: remote polling integration

## Current contract

Worker base URL: `https://jarvis-v2-cloud.viole-jarvis.workers.dev`

The Android Claw Use app currently exposes a local HTTP server on port 7333. A private LAN IP is not reachable from the Cloudflare Worker over mobile data. The Android app must initiate outbound HTTPS requests to the Worker, or a separately secured tunnel must be maintained.

### Worker routes

- `GET /health`: public service health only; it does not prove the executor is online.
- `GET /v2/claw/status?deviceId=primary`: Jarvis UI credential (`Authorization: Bearer …`); queue diagnostics, and `deviceOnline: null` until an executor heartbeat exists.
- `POST /v2/claw/commands`: Jarvis UI credential; requires `approved: true` and a structured action with an allowlisted action key.
- `GET /v2/claw/commands/next?deviceId=primary`: executor credential in `X-Bridge-Token`; returns `{ ok: true, command: null }` or a leased command object.
- `POST /v2/claw/commands/{id}/result`: executor credential in `X-Bridge-Token`; JSON body must include `status: "completed" | "failed"`, optionally `summary` and `error`.

The Worker expects `CLAW_USE_BRIDGE_TOKEN_SECRET` (preferred) or the legacy `CLAW_USE_BRIDGE_TOKEN` binding for executor routes. This credential is distinct from both the browser's `JARVIS_ACCESS_TOKEN` and Claw Use's own local bridge token. Do not reuse one credential for all three purposes.

## Confirmed implementation mismatch

The repository's existing `app/src/main/java/com/viole/jarvis/claw/ClawCommandExecutor.kt` sends `Authorization: Bearer <jarvisAccessToken>` to the executor routes. The Worker currently expects `X-Bridge-Token` for those routes. That client will receive HTTP 401 unless the Worker contract or client is corrected. Do not infer that this class is running inside the separately installed Claw Use app: it belongs to the Jarvis Android application.

The current Claw Use upstream repository exposes its local API but does not, in the inspected code, contain a Worker polling loop. Integrating polling into that app requires changes to its Android project and a new build. This document alone does not implement or deploy that Android change.

## Recommended Android design

1. Keep the existing local bridge API for local clients.
2. Add an opt-in remote executor to the Claw Use foreground service. While enabled, it polls the Worker over HTTPS on a single background executor, with a bounded timeout and backoff.
3. Use a dedicated Worker bridge credential stored in Android private storage. Never log it, place it in a URL, or transmit it to any other endpoint.
4. Do not use periodic WorkManager for 15–30 second polling: Android's periodic WorkManager interval has a 15-minute minimum and can be delayed by battery optimizations. A foreground service is the suitable candidate while the user has explicitly enabled remote control and the ongoing notification is visible. Stop polling when the user disables it.
5. Accept only allowlisted, structured commands. Show a local confirmation for any action that can change another app or transmit data. Never execute a command merely because a server field says it is approved; require local policy/consent too.
6. After execution, report only the command ID, status, and bounded result summary. Do not upload screenshots, clipboard contents, notifications, contacts, or other personal data unless the user explicitly requested that specific data transfer.
7. Add an authenticated executor heartbeat so the UI can distinguish “configured” from “online”. Until that exists, keep `deviceOnline: null`.
8. Use bounded leases and idempotent command IDs. A timeout or duplicate poll must not cause an action to run twice. Expired leases should be retried only with an explicit idempotency policy.

## Manual smoke-test contract

These checks intentionally do not include a real credential:

- `GET /health` should return 200 and JSON with `ok: true`.
- Unauthenticated `GET /v2/claw/commands/next?deviceId=primary` should return 401.
- Unauthenticated `GET /v2/claw/status?deviceId=primary` should return 401.
- With the correct Worker bridge credential, `GET /v2/claw/commands/next?deviceId=primary` should return 200 and either `command: null` or a command envelope.
- A result POST should be tested only against a command that was actually leased. Expected status is 200; repeating the same result should not silently complete a different command.
- Test an actual Android capture and a harmless action only after the polling client has been built and installed. A successful health check or queue response is not proof of device execution.

## Remaining work

- Implement the polling loop inside a writable Claw Use Android source tree.
- Wire it to the app's existing handler methods rather than inventing new APIs.
- Add tests for auth rejection, malformed payloads, lease expiry, retry/backoff, duplicate commands, app stop/restart, network changes, and user takeover.
- Build the APK in CI and verify the artifact and checksum.
- On the device, test Wi-Fi → mobile data, screen locked/unlocked, accessibility disconnected, and user-disabled remote mode.
- Only then claim end-to-end integration is complete.

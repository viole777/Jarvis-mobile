# Jarvis Web ↔ Android Bridge — Milestone 1

## Goal
Keep Jarvis Web as the primary interface and use a small, explicitly authorized Android companion for device actions. The first verifiable action is opening an installed app.

## Architecture
- Jarvis Web remains the conversation UI.
- Cloudflare Worker authenticates requests and brokers commands through D1.
- Android companion registers a device, polls for pending commands over HTTPS, executes only an allowlisted action, and posts a result.
- Device identity must be separate from the master Jarvis access token. Do not embed the Cloudflare secret in the app or browser.
- The user enables Android Accessibility manually in system settings before adding screen reading/clicks in a later milestone.

## First action contract
A command is a bounded JSON object:
```json
{
  "id": "server-generated-id",
  "action": "open_app",
  "packageName": "com.whatsapp",
  "expiresAt": "server-generated ISO-8601 timestamp"
}
```
The server must generate IDs and expiry; the client must reject expired or unknown actions. The initial allowlist is limited to installed app launch intents. No arbitrary shell, arbitrary intents, SMS sending, purchases, or destructive actions.

## Required server routes
- `POST /v2/device/register`: authenticate an owner session, register a device public identifier, return a short-lived pairing challenge.
- `POST /v2/device/pair`: exchange a one-time pairing challenge for a per-device credential; store only a hash of that credential.
- `POST /v2/device/commands`: enqueue an allowlisted command with expiry; return its ID.
- `GET /v2/device/poll`: authenticate the device, claim one pending command atomically.
- `POST /v2/device/result`: authenticate the device and record success/failure for the claimed command.
- `GET /v2/device/status`: show last-seen time and connection state to the web UI.

## Security requirements
1. Never reuse or expose `JARVIS_ACCESS_TOKEN` as the Android device credential.
2. Require pairing confirmation in the web session and on the phone.
3. Use HTTPS only, short command expiry, unique IDs, replay protection, and rate limits.
4. Only accept a fixed action enum and validated package names. Reject arbitrary code/URLs/intent extras.
5. Show a visible Android notification while remote control is active; provide an immediate disconnect switch.
6. Ask for confirmation before messaging, posting, deleting, purchasing, or other consequential actions.
7. Do not read notification contents or screen contents unless the user explicitly enables the corresponding Android permission.
8. Keep an audit log with action, time, result, and device ID; avoid logging message bodies or screen contents.

## Acceptance test
1. Pair the phone manually.
2. Web UI shows the phone as online.
3. User requests “open WhatsApp” and explicitly approves.
4. Phone opens WhatsApp and returns a command result.
5. An expired, replayed, malformed, or non-allowlisted command is rejected.
6. Disconnecting the phone stops command polling.

## Current status
This file is the implementation contract, not a claim that the bridge is already running. Server routes, D1 schema, web controls, Android polling/foreground service, and end-to-end tests still need implementation before the milestone can be called complete.

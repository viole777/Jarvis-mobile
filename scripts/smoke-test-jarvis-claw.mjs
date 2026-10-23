#!/usr/bin/env node
/**
 * Public smoke checks for the deployed Jarvis Worker.
 * No credentials are accepted or printed. This does NOT test authenticated
 * queue operations or Android execution.
 */
const base = (process.env.JARVIS_BASE_URL || "https://jarvis-v2-cloud.viole-jarvis.workers.dev").replace(/\/$/, "");

async function check(path, expectedStatus, validate) {
  const response = await fetch(base + path, { headers: { accept: "application/json" } });
  const raw = await response.text();
  let json;
  try { json = JSON.parse(raw); } catch { json = null; }
  const ok = response.status === expectedStatus && (!validate || validate(json));
  console.log(`${ok ? "PASS" : "FAIL"} ${path}: HTTP ${response.status} (expected ${expectedStatus})`);
  if (!ok) process.exitCode = 1;
}

await check("/health", 200, body => body?.ok === true);
await check("/v2/claw/commands/next?deviceId=primary", 401, body => body?.error === "Não autorizado.");
await check("/v2/claw/status?deviceId=primary", 401, body => body?.error === "Não autorizado.");

console.log("Scope: public health + unauthenticated rejection only; no valid tokens, queue writes, or device actions were tested.");

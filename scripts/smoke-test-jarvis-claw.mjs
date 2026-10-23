#!/usr/bin/env node
/**
 * Public smoke checks for the deployed Jarvis Worker.
 * No credentials are accepted or printed. This does NOT test authenticated
 * chat, queue operations, or Android execution.
 */
const base = (process.env.JARVIS_BASE_URL || "https://jarvis-v2-cloud.viole-jarvis.workers.dev").replace(/\/$/, "");
const timeoutMs = 10000;

async function request(path) {
  return fetch(base + path, {
    headers: { accept: "application/json, text/html" },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function checkJson(path, expectedStatus, validate) {
  try {
    const response = await request(path);
    const raw = await response.text();
    let json;
    try { json = JSON.parse(raw); } catch { json = null; }
    const ok = response.status === expectedStatus && (!validate || validate(json));
    console.log(`${ok ? "PASS" : "FAIL"} ${path}: HTTP ${response.status} (expected ${expectedStatus})`);
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.log(`FAIL ${path}: ${error.name === "TimeoutError" ? "request timed out" : "request failed"}`);
    process.exitCode = 1;
  }
}

async function checkPage(path) {
  try {
    const response = await request(path);
    const html = await response.text();
    const ok = response.status === 200
      && (response.headers.get("content-type") || "").includes("text/html")
      && html.includes("<title>J.A.R.V.I.S.");
    console.log(`${ok ? "PASS" : "FAIL"} ${path}: HTTP ${response.status}, HTML ${ok ? "valid" : "invalid"}`);
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.log(`FAIL ${path}: ${error.name === "TimeoutError" ? "request timed out" : "request failed"}`);
    process.exitCode = 1;
  }
}

await checkPage("/");
await checkPage("/app");
await checkJson("/health", 200, body => body?.ok === true);
await checkJson("/v2/claw/commands/next?deviceId=primary", 401, body => body?.error === "Não autorizado.");
await checkJson("/v2/claw/status?deviceId=primary", 401, body => body?.error === "Não autorizado.");

console.log("Scope: public HTML + health + unauthenticated rejection only; no valid tokens, chat, queue writes, or device actions were tested.");

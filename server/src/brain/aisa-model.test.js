import test from "node:test";
import assert from "node:assert/strict";
import { AIsaModelClient } from "./aisa-model.js";

test("fails closed when the AIsa key or model is missing", async () => {
  const client = new AIsaModelClient({ apiKey: "", model: "" });
  await assert.rejects(client.complete({ messages: [{ role: "user", content: "Oi" }] }), (error) => error.statusCode === 503);
});

test("sends OpenAI-compatible chat and tool schemas to AIsa", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedOptions;
  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return new Response(JSON.stringify({
      choices: [{ message: {
        content: "Vou abrir o aplicativo.",
        tool_calls: [{ id: "call_1", function: { name: "open_app", arguments: "{\"packageName\":\"com.example.app\"}" } }]
      } }],
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const client = new AIsaModelClient({
      apiKey: "test-only-secret",
      model: "test-model",
      baseUrl: "https://api.aisa.one/v1/"
    });
    const result = await client.complete({
      messages: [{ type: "user", content: "Abra o aplicativo" }],
      tools: [{
        name: "open_app",
        description: "Open an app",
        parameters: [{ name: "packageName", type: "STRING", description: "Package name", required: true }]
      }]
    });

    assert.equal(capturedUrl, "https://api.aisa.one/v1/chat/completions");
    assert.equal(capturedOptions.headers.Authorization, "Bearer test-only-secret");
    const payload = JSON.parse(capturedOptions.body);
    assert.equal(payload.model, "test-model");
    assert.equal(payload.tools[0].function.name, "open_app");
    assert.deepEqual(payload.tools[0].function.parameters.required, ["packageName"]);
    assert.equal(result.text, "Vou abrir o aplicativo.");
    assert.equal(result.toolCalls[0].name, "open_app");
    assert.deepEqual(result.toolCalls[0].arguments, { packageName: "com.example.app" });
    assert.equal(result.isFinal, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("allows runtime configuration without exposing credentials in status", () => {
  const client = new AIsaModelClient({ apiKey: "", model: "" });
  assert.equal(client.isConfigured(), false);
  assert.equal(client.configure({ apiKey: "runtime-test-secret", model: "runtime-model" }), true);
  assert.equal(client.isConfigured(), true);
  assert.equal(client.model, "runtime-model");
});


test("automatically retries a configured fallback after provider quota/rate-limit errors", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, auth: options.headers.Authorization, model: JSON.parse(options.body).model });
    if (calls.length === 1) return new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "Fallback funcionando", tool_calls: [] } }], usage: { total_tokens: 9 } }), { status: 200 });
  };
  try {
    const client = new AIsaModelClient({
      apiKey: "primary-test-key",
      model: "primary-model",
      baseUrl: "https://primary.example/v1",
      fallbacks: [{ apiKey: "fallback-test-key", model: "fallback-model", baseUrl: "https://fallback.example/v1" }]
    });
    const result = await client.complete({ messages: [{ role: "user", content: "teste" }] });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].model, "primary-model");
    assert.equal(calls[1].model, "fallback-model");
    assert.equal(calls[1].auth, "Bearer fallback-test-key");
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.model, "fallback-model");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preserves validated image parts for multimodal requests", async () => {
  const originalFetch = globalThis.fetch;
  let payload;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: "Vejo uma imagem.", tool_calls: [] } }] }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const client = new AIsaModelClient({ apiKey: "test-key", model: "vision-model" });
    await client.complete({
      messages: [{ role: "user", content: [
        { type: "text", text: "Descreva a imagem" },
        { type: "image_url", image_url: { url: "data:image/jpeg;base64,ZmFrZQ==" } },
        { type: "image_url", image_url: { url: "https://example.com/remote.png" } }
      ] }]
    });
    assert.equal(payload.messages[0].content.length, 2);
    assert.equal(payload.messages[0].content[0].text, "Descreva a imagem");
    assert.equal(payload.messages[0].content[1].image_url.url, "data:image/jpeg;base64,ZmFrZQ==");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("supports a loopback local OpenAI-compatible model without an API key", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.JARVIS_LOCAL_MODEL_URL;
  const originalName = process.env.JARVIS_LOCAL_MODEL_NAME;
  process.env.JARVIS_LOCAL_MODEL_URL = "http://127.0.0.1:11434/v1";
  process.env.JARVIS_LOCAL_MODEL_NAME = "qwen2.5:3b";
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ choices: [{ message: { content: "Resposta local", tool_calls: [] } }] }), { status: 200 });
  };
  try {
    const client = new AIsaModelClient({ apiKey: "", fallbacks: [] });
    assert.equal(client.isConfigured(), true);
    const result = await client.complete({ messages: [{ role: "user", content: "Oi" }] });
    assert.equal(captured.url, "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal("Authorization" in captured.options.headers, false);
    assert.equal(JSON.parse(captured.options.body).model, "qwen2.5:3b");
    assert.equal(result.text, "Resposta local");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.JARVIS_LOCAL_MODEL_URL; else process.env.JARVIS_LOCAL_MODEL_URL = originalUrl;
    if (originalName === undefined) delete process.env.JARVIS_LOCAL_MODEL_NAME; else process.env.JARVIS_LOCAL_MODEL_NAME = originalName;
  }
});

test("rejects remote unauthenticated local-model endpoints", async () => {
  const originalUrl = process.env.JARVIS_LOCAL_MODEL_URL;
  process.env.JARVIS_LOCAL_MODEL_URL = "http://example.com/v1";
  try {
    const client = new AIsaModelClient({ apiKey: "", model: "test-model", fallbacks: [] });
    assert.equal(client.isConfigured(), false);
    await assert.rejects(client.complete({ messages: [{ role: "user", content: "Oi" }] }), (error) => error.statusCode === 400);
  } finally {
    if (originalUrl === undefined) delete process.env.JARVIS_LOCAL_MODEL_URL; else process.env.JARVIS_LOCAL_MODEL_URL = originalUrl;
  }
});

test("automatically tries compatible fallback models after HTTP 400", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    const model = JSON.parse(options.body).model;
    calls.push(model);
    if (model === "primary-model") {
      return new Response(JSON.stringify({ error: { message: "Unsupported parameter for this model" } }), { status: 400 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "Recuperação concluída", tool_calls: [] } }] }), { status: 200 });
  };
  try {
    const client = new AIsaModelClient({
      apiKey: "test-only-key",
      model: "primary-model",
      baseUrl: "https://primary.example/v1",
      fallbacks: [{ apiKey: "test-only-key", model: "compatible-fallback", baseUrl: "https://primary.example/v1" }]
    });
    const result = await client.complete({ messages: [{ role: "user", content: "Oi" }] });
    assert.deepEqual(calls, ["primary-model", "compatible-fallback"]);
    assert.equal(result.text, "Recuperação concluída");
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.model, "compatible-fallback");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns the upstream HTTP 400 diagnostic when no fallback exists", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { message: "Invalid request payload" }
  }), { status: 400 });
  try {
    const client = new AIsaModelClient({ apiKey: "test-only-key", model: "broken-model" });
    await assert.rejects(client.complete({ messages: [{ role: "user", content: "Oi" }] }), (error) => {
      assert.match(error.message, /HTTP 400/);
      assert.match(error.message, /Invalid request payload/);
      assert.equal(error.providerStatus, 400);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

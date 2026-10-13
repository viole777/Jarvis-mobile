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

import test from "node:test";
import assert from "node:assert/strict";
import { JARVIS_TOOLS, executeJarvisTool } from "./tool-registry.js";

test("exposes only bounded, read-only built-in tools", () => {
  assert.deepEqual(JARVIS_TOOLS.map((tool) => tool.name), [
    "get_jarvis_status",
    "list_skills",
    "read_own_repo_file",
    "list_own_repo_directory"
  ]);
});

test("status tool never exposes API keys", async () => {
  const result = JSON.parse(await executeJarvisTool("get_jarvis_status", {}, {
    aisa: { isConfigured: () => true, model: "test-model", fallbacks: [{}], apiKey: "must-not-leak" },
    listSkills: () => [{ id: "demo", title: "Demo" }]
  }));
  assert.equal(result.modelConfigured, true);
  assert.equal(result.primaryModel, "test-model");
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false);
});

test("repository file tool rejects traversal without making a network request", async () => {
  const result = JSON.parse(await executeJarvisTool("read_own_repo_file", { path: "../.env" }, {
    aisa: {},
    listSkills: () => []
  }));
  assert.match(result.error, /Invalid/);
});

test("repository file tool reads a public file and bounds its output", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    type: "file",
    content: Buffer.from("hello Jarvis").toString("base64"),
    html_url: "https://github.com/viole777/Jarvis-mobile/blob/main/README.md"
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const result = JSON.parse(await executeJarvisTool("read_own_repo_file", { path: "README.md" }, {
      aisa: {},
      listSkills: () => []
    }));
    assert.equal(result.content, "hello Jarvis");
    assert.equal(result.path, "README.md");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

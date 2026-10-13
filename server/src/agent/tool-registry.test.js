import test from "node:test";
import assert from "node:assert/strict";
import { JARVIS_TOOLS, executeJarvisTool } from "./tool-registry.js";

test("exposes bounded tools with gated PR-only GitHub writes", () => {
  assert.deepEqual(JARVIS_TOOLS.map((tool) => tool.name), [
    "get_jarvis_status",
    "list_skills",
    "read_own_repo_file",
    "list_own_repo_directory",
    "propose_github_file_change"
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

test("GitHub writes fail closed unless explicitly enabled", async () => {
  const previousEnabled = process.env.JARVIS_GITHUB_WRITE_ENABLED;
  const previousToken = process.env.GITHUB_TOKEN;
  delete process.env.JARVIS_GITHUB_WRITE_ENABLED;
  process.env.GITHUB_TOKEN = "test-token";
  try {
    const result = JSON.parse(await executeJarvisTool("propose_github_file_change", {
      path: "server/src/demo.js", content: "export default 1;", summary: "Add demo"
    }));
    assert.match(result.error, /disabled/i);
  } finally {
    if (previousEnabled === undefined) delete process.env.JARVIS_GITHUB_WRITE_ENABLED;
    else process.env.JARVIS_GITHUB_WRITE_ENABLED = previousEnabled;
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
  }
});

test("GitHub write policy blocks secret paths and credential-like content", async () => {
  const previousEnabled = process.env.JARVIS_GITHUB_WRITE_ENABLED;
  const previousToken = process.env.GITHUB_TOKEN;
  process.env.JARVIS_GITHUB_WRITE_ENABLED = "true";
  process.env.GITHUB_TOKEN = "test-token";
  try {
    const pathResult = JSON.parse(await executeJarvisTool("propose_github_file_change", {
      path: ".github/workflows/deploy.yml", content: "hello", summary: "test"
    }));
    assert.match(pathResult.error, /Path blocked/i);
    const secretResult = JSON.parse(await executeJarvisTool("propose_github_file_change", {
      path: "server/src/demo.js", content: 'const api_key = "this-is-a-long-secret-value";', summary: "test"
    }));
    assert.match(secretResult.error, /resembles a credential/i);
  } finally {
    if (previousEnabled === undefined) delete process.env.JARVIS_GITHUB_WRITE_ENABLED;
    else process.env.JARVIS_GITHUB_WRITE_ENABLED = previousEnabled;
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
  }
});

test("GitHub write creates a draft PR and never merges or deploys", async () => {
  const previousEnabled = process.env.JARVIS_GITHUB_WRITE_ENABLED;
  const previousToken = process.env.GITHUB_TOKEN;
  const originalFetch = globalThis.fetch;
  process.env.JARVIS_GITHUB_WRITE_ENABLED = "true";
  process.env.GITHUB_TOKEN = "test-token";
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null });
    if (String(url).includes("/git/ref/heads/main")) {
      return new Response(JSON.stringify({ object: { sha: "base-sha" } }), { status: 200 });
    }
    if (String(url).endsWith("/git/refs")) {
      return new Response(JSON.stringify({ ref: "refs/heads/jarvis/agent-test" }), { status: 201 });
    }
    if (String(url).includes("/contents/server/src/demo.js?ref=")) {
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }
    if (String(url).endsWith("/contents/server/src/demo.js") && options.method === "PUT") {
      return new Response(JSON.stringify({ commit: { sha: "file-commit" } }), { status: 201 });
    }
    if (String(url).endsWith("/pulls")) {
      return new Response(JSON.stringify({ html_url: "https://github.com/viole777/Jarvis-mobile/pull/123", number: 123 }), { status: 201 });
    }
    throw new Error("Unexpected test request: " + url);
  };
  try {
    const result = JSON.parse(await executeJarvisTool("propose_github_file_change", {
      path: "server/src/demo.js", content: "export default 1;", summary: "Add demo module"
    }));
    assert.equal(result.ok, true);
    assert.equal(result.number, 123);
    assert.equal(result.merged, false);
    assert.equal(result.deployed, false);
    assert.equal(requests.some((request) => request.method === "PUT"), true);
    const pullRequest = requests.find((request) => request.url.endsWith("/pulls"));
    assert.equal(pullRequest.body.draft, true);
    assert.equal(pullRequest.body.base, "main");
    assert.equal(requests.some((request) => /\/merges$/.test(request.url)), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousEnabled === undefined) delete process.env.JARVIS_GITHUB_WRITE_ENABLED;
    else process.env.JARVIS_GITHUB_WRITE_ENABLED = previousEnabled;
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
  }
});

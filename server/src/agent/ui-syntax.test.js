import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

test("Jarvis browser UI inline script has valid JavaScript syntax", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
  assert.ok(scripts.length > 0, "expected an inline browser script");
  for (const match of scripts) new vm.Script(match[1]);
});

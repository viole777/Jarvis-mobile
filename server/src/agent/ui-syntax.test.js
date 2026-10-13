import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

test("Jarvis browser UI inline script has valid JavaScript syntax", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const start = html.indexOf("<script>");
  const end = html.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start, "expected an inline browser script");
  new vm.Script(html.slice(start + 8, end));
});

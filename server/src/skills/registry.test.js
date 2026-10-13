import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listSkills, loadSkills, skillsSystemMessage } from "./registry.js";

test("lists and loads only valid skill folders with SKILL.md", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-skills-"));
  try {
    fs.mkdirSync(path.join(root, "hello-world"));
    fs.writeFileSync(path.join(root, "hello-world", "SKILL.md"), "# Hello World\nA sample skill.\nDo the task safely.");
    fs.mkdirSync(path.join(root, "bad name"));
    fs.writeFileSync(path.join(root, "bad name", "SKILL.md"), "# Should be ignored");
    fs.mkdirSync(path.join(root, "missing-file"));
    assert.deepEqual(listSkills({ skillsDir: root }).map((item) => item.id), ["hello-world"]);
    assert.equal(loadSkills(["../bad name", "hello-world"], { skillsDir: root }).length, 1);
    assert.match(skillsSystemMessage(loadSkills(["hello-world"], { skillsDir: root })), /untrusted/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

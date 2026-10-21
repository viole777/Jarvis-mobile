import test from "node:test";
import assert from "node:assert/strict";
import { LearningExperienceStore, normalizeExperienceInput } from "./experience-store.js";

const valid = {
  source: "hermes",
  task: "Find the right tool for a request",
  outcome: "Selected read_screen and validated the result",
  success: true,
  tags: ["tool-use", "reviewed-example"]
};

test("normalizes experience metadata and keeps every new record unverified", async () => {
  const store = new LearningExperienceStore({ databaseUrl: "" });
  const record = await store.create(valid);
  assert.match(record.id, /^[0-9a-f-]{36}$/i);
  assert.equal(record.source, "hermes");
  assert.equal(record.verified, false);
  assert.deepEqual(record.tags, ["tool-use", "reviewed-example"]);
  assert.equal((await store.list({ verifiedOnly: true })).length, 0);
  assert.equal((await store.list()).length, 1);
});

test("rejects malformed or unsupported teacher data", () => {
  assert.throws(() => normalizeExperienceInput({ ...valid, source: "unknown" }), /source must be/);
  assert.throws(() => normalizeExperienceInput({ ...valid, success: "yes" }), /success must be a boolean/);
  assert.throws(() => normalizeExperienceInput({ ...valid, task: "  " }), /task must not be empty/);
  assert.throws(() => normalizeExperienceInput({ ...valid, task: "x".repeat(4001) }), /exceeds/);
  assert.throws(() => normalizeExperienceInput({ ...valid, tags: ["../secrets"] }), /Tags must be/);
  assert.throws(() => normalizeExperienceInput({ ...valid, outcome: "token sk-proj-abcdefghijklmnopqrstuvwxyz0123456789" }), /credential/);
});

test("only explicitly reviewed experiences are eligible for verified listing", async () => {
  const store = new LearningExperienceStore({ databaseUrl: "" });
  const first = await store.create(valid);
  const second = await store.create({ ...valid, task: "A second independent task" });
  await store.verify(first.id, true);
  assert.deepEqual((await store.list({ verifiedOnly: true })).map((item) => item.id), [first.id]);
  await store.verify(first.id, false);
  assert.deepEqual(await store.list({ verifiedOnly: true }), []);
  await assert.rejects(() => store.verify(second.id + "not-a-uuid"), /UUID/);
  await assert.rejects(() => store.verify("123e4567-e89b-12d3-a456-426614174000"), /not found/);
});

test("memory fallback is bounded and advertises its non-persistent mode", async () => {
  const store = new LearningExperienceStore({ databaseUrl: "", maxMemoryRecords: 2 });
  assert.equal(store.mode, "memory");
  await store.create(valid);
  await store.create({ ...valid, task: "Second" });
  await store.create({ ...valid, task: "Third" });
  assert.equal((await store.list()).length, 2);
  assert.equal((await store.list())[0].task, "Third");
});

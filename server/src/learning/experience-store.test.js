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


test("PostgreSQL mode initializes schema and uses parameterized writes", async () => {
  const calls = [];
  const dbRecord = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    created_at: new Date("2026-10-21T12:00:00.000Z"),
    source: "hermes",
    task: valid.task,
    outcome: valid.outcome,
    success: true,
    verified: false,
    tags: valid.tags
  };
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("CREATE TABLE IF NOT EXISTS")) return { rows: [], rowCount: 0 };
      if (sql.startsWith("INSERT INTO")) return { rows: [], rowCount: 1 };
      if (sql.startsWith("SELECT")) return { rows: [{ ...dbRecord, verified: params[0] ? true : false }], rowCount: 1 };
      if (sql.startsWith("UPDATE")) return { rows: [{ ...dbRecord, verified: params[1] }], rowCount: 1 };
      throw new Error("Unexpected SQL in test");
    },
    async end() {}
  };
  const store = new LearningExperienceStore({ pool });
  assert.equal(store.mode, "postgres");
  const created = await store.create(valid);
  assert.equal(created.verified, false);
  assert.equal(calls.some((call) => call.sql.includes("CREATE TABLE IF NOT EXISTS jarvis_learning_experiences")), true);
  const insert = calls.find((call) => call.sql.startsWith("INSERT INTO"));
  assert.equal(insert.params[2], "hermes");
  assert.equal(insert.params[3], valid.task);
  assert.equal(insert.sql.includes(valid.task), false, "user text must be passed as a parameter, not interpolated into SQL");
  const reviewed = await store.verify(dbRecord.id, true);
  assert.equal(reviewed.verified, true);
  const verified = await store.list({ verifiedOnly: true, limit: 10 });
  assert.equal(verified.length, 1);
  assert.equal(calls.some((call) => call.sql.includes("verified = TRUE")), false, "filter uses a parameterized boolean");
});

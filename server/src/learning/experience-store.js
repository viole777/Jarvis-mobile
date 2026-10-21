import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const MAX_TASK_LENGTH = 4_000;
const MAX_OUTCOME_LENGTH = 4_000;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 48;
const MAX_MEMORY_RECORDS = 500;
const SOURCES = new Set(["jarvis", "hermes", "teacher", "human"]);
const SECRET_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:sk-proj-|sk-live-|gh[pousr]_[A-Za-z0-9_]{20,})/i;

function cleanText(value, field, maxLength) {
  if (typeof value !== "string") throw Object.assign(new Error(field + " must be a string."), { statusCode: 400 });
  const text = value.trim();
  if (!text) throw Object.assign(new Error(field + " must not be empty."), { statusCode: 400 });
  if (text.length > maxLength) throw Object.assign(new Error(field + " exceeds " + maxLength + " characters."), { statusCode: 400 });
  if (SECRET_PATTERN.test(text)) throw Object.assign(new Error(field + " appears to contain a credential. Remove secrets before saving."), { statusCode: 400 });
  return text;
}

export function normalizeExperienceInput(input = {}) {
  const source = typeof input.source === "string" ? input.source.trim().toLowerCase() : "jarvis";
  if (!SOURCES.has(source)) throw Object.assign(new Error("source must be jarvis, hermes, teacher, or human."), { statusCode: 400 });
  if (typeof input.success !== "boolean") throw Object.assign(new Error("success must be a boolean describing the observed outcome."), { statusCode: 400 });
  const tagsInput = input.tags === undefined ? [] : input.tags;
  if (!Array.isArray(tagsInput) || tagsInput.length > MAX_TAGS) throw Object.assign(new Error("tags must be an array with at most " + MAX_TAGS + " items."), { statusCode: 400 });
  const tags = [...new Set(tagsInput.map((tag) => {
    if (typeof tag !== "string") throw Object.assign(new Error("Every tag must be a string."), { statusCode: 400 });
    const normalized = tag.trim().toLowerCase();
    if (!normalized || normalized.length > MAX_TAG_LENGTH || !/^[a-z0-9][a-z0-9 _-]*$/.test(normalized)) {
      throw Object.assign(new Error("Tags must be short, lowercase labels using letters, numbers, spaces, underscores, or hyphens."), { statusCode: 400 });
    }
    return normalized;
  }))];
  return {
    source,
    task: cleanText(input.task, "task", MAX_TASK_LENGTH),
    outcome: cleanText(input.outcome, "outcome", MAX_OUTCOME_LENGTH),
    success: input.success,
    tags
  };
}

export class LearningExperienceStore {
  constructor({ pool, databaseUrl = process.env.DATABASE_URL, maxMemoryRecords = MAX_MEMORY_RECORDS } = {}) {
    this.pool = pool === undefined && databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false }, max: 5, connectionTimeoutMillis: 5000 }) : (pool || null);
    this.maxMemoryRecords = maxMemoryRecords;
    this.records = [];
    this.schemaPromise = null;
  }

  get mode() {
    return this.pool ? "postgres" : "memory";
  }

  async ensureSchema() {
    if (!this.pool) return;
    if (!this.schemaPromise) {
      this.schemaPromise = this.pool.query(`
        CREATE TABLE IF NOT EXISTS jarvis_learning_experiences (
          id UUID PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL,
          source TEXT NOT NULL CHECK (source IN ('jarvis','hermes','teacher','human')),
          task TEXT NOT NULL,
          outcome TEXT NOT NULL,
          success BOOLEAN NOT NULL,
          verified BOOLEAN NOT NULL DEFAULT FALSE,
          tags JSONB NOT NULL DEFAULT '[]'::jsonb
        );
        CREATE INDEX IF NOT EXISTS jarvis_learning_experiences_created_idx
          ON jarvis_learning_experiences (created_at DESC);
        CREATE INDEX IF NOT EXISTS jarvis_learning_experiences_verified_idx
          ON jarvis_learning_experiences (verified, created_at DESC);
      `);
    }
    try {
      await this.schemaPromise;
    } catch (error) {
      this.schemaPromise = null;
      throw Object.assign(new Error("Learning storage is unavailable. Check DATABASE_URL and database permissions."), { statusCode: 503, cause: error });
    }
  }

  async create(input) {
    const normalized = normalizeExperienceInput(input);
    const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...normalized, verified: false };
    if (!this.pool) {
      this.records.unshift(record);
      this.records.length = Math.min(this.records.length, this.maxMemoryRecords);
      return { ...record, tags: [...record.tags] };
    }
    await this.ensureSchema();
    await this.pool.query(
      "INSERT INTO jarvis_learning_experiences (id, created_at, source, task, outcome, success, verified, tags) VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7::jsonb)",
      [record.id, record.createdAt, record.source, record.task, record.outcome, record.success, JSON.stringify(record.tags)]
    );
    return record;
  }

  async list({ limit = 50, verifiedOnly = false } = {}) {
    const boundedLimit = Math.max(1, Math.min(100, Number.isInteger(Number(limit)) ? Number(limit) : 50));
    if (!this.pool) {
      return this.records.filter((record) => !verifiedOnly || record.verified).slice(0, boundedLimit).map((record) => ({ ...record, tags: [...record.tags] }));
    }
    await this.ensureSchema();
    const result = await this.pool.query(
      "SELECT id, created_at, source, task, outcome, success, verified, tags FROM jarvis_learning_experiences WHERE ($1::boolean = FALSE OR verified = TRUE) ORDER BY created_at DESC LIMIT $2",
      [Boolean(verifiedOnly), boundedLimit]
    );
    return result.rows.map((row) => ({
      id: row.id, createdAt: new Date(row.created_at).toISOString(), source: row.source,
      task: row.task, outcome: row.outcome, success: row.success, verified: row.verified,
      tags: Array.isArray(row.tags) ? row.tags : []
    }));
  }

  async verify(id, verified = true) {
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
      throw Object.assign(new Error("A valid experience UUID is required."), { statusCode: 400 });
    }
    if (typeof verified !== "boolean") throw Object.assign(new Error("verified must be a boolean."), { statusCode: 400 });
    if (!this.pool) {
      const record = this.records.find((item) => item.id === id);
      if (!record) throw Object.assign(new Error("Learning experience not found."), { statusCode: 404 });
      record.verified = verified;
      return { ...record, tags: [...record.tags] };
    }
    await this.ensureSchema();
    const result = await this.pool.query(
      "UPDATE jarvis_learning_experiences SET verified = $2 WHERE id = $1 RETURNING id, created_at, source, task, outcome, success, verified, tags",
      [id, verified]
    );
    if (!result.rowCount) throw Object.assign(new Error("Learning experience not found."), { statusCode: 404 });
    const row = result.rows[0];
    return { id: row.id, createdAt: new Date(row.created_at).toISOString(), source: row.source, task: row.task, outcome: row.outcome, success: row.success, verified: row.verified, tags: Array.isArray(row.tags) ? row.tags : [] };
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}

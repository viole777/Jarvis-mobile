const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_TEXT = 12000;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};
function reply(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
}
function clean(value, max = MAX_TEXT) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
async function ensureSchema(db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS jarvis_memories (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'note', content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))"),
    db.prepare("CREATE TABLE IF NOT EXISTS jarvis_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))"),
    db.prepare("CREATE TABLE IF NOT EXISTS jarvis_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))"),
    db.prepare("CREATE TABLE IF NOT EXISTS jarvis_pulses (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))"),
  ]);
}
function authorized(request, env) {
  const expected = clean(env.JARVIS_ACCESS_TOKEN, 300);
  if (!expected) return false;
  return request.headers.get("Authorization") === `Bearer ${expected}`;
}
async function state(db, key, fallback = "") {
  const row = await db.prepare("SELECT value FROM jarvis_state WHERE key = ?").bind(key).first();
  return row?.value ?? fallback;
}
async function setState(db, key, value) {
  await db.prepare("INSERT INTO jarvis_state(key,value,updated_at) VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind(key, String(value)).run();
}
async function handle(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    return reply({ ok: true, service: "Jarvis V2 Cloud", authRequired: true, model: MODEL, persistentMemory: Boolean(env.DB), scheduledAgent: true });
  }
  if (!authorized(request, env)) return reply({ error: "Não autorizado." }, 401);
  if (!env.DB || !env.AI) return reply({ error: "Bindings DB/AI não configurados." }, 503);
  await ensureSchema(env.DB);

  if (url.pathname === "/v2/status" && request.method === "GET") {
    const lastCheckin = await state(env.DB, "last_checkin", "");
    const attention = await state(env.DB, "attention_state", "normal");
    const pulse = await env.DB.prepare("SELECT kind,detail,created_at FROM jarvis_pulses ORDER BY id DESC LIMIT 1").first();
    const memories = await env.DB.prepare("SELECT COUNT(*) AS total FROM jarvis_memories").first();
    return reply({ ok: true, model: MODEL, lastCheckin: lastCheckin || null, attention, latestPulse: pulse || null, memoryCount: memories?.total || 0, serverTime: new Date().toISOString() });
  }

  if (url.pathname === "/v2/checkin" && request.method === "POST") {
    const payload = await request.json().catch(() => ({}));
    const note = clean(payload.note, 1000);
    const now = new Date().toISOString();
    await setState(env.DB, "last_checkin", now);
    await setState(env.DB, "attention_state", "normal");
    await env.DB.prepare("INSERT INTO jarvis_pulses(kind,detail) VALUES('checkin',?)").bind(note || "Check-in manual recebido.").run();
    return reply({ ok: true, lastCheckin: now, attention: "normal" }, 201);
  }

  if (url.pathname === "/v2/memory" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT id,kind,content,created_at FROM jarvis_memories ORDER BY id DESC LIMIT 50").all();
    return reply({ ok: true, memories: rows.results || [] });
  }

  if (url.pathname === "/v2/memory" && request.method === "POST") {
    const payload = await request.json().catch(() => ({}));
    const content = clean(payload.content, 4000);
    const kind = clean(payload.kind, 40) || "note";
    if (!content) return reply({ error: "O campo content é obrigatório." }, 400);
    const result = await env.DB.prepare("INSERT INTO jarvis_memories(kind,content) VALUES(?,?)").bind(kind, content).run();
    return reply({ ok: true, id: result.meta?.last_row_id, kind, content }, 201);
  }

  if (url.pathname === "/v2/chat" && request.method === "POST") {
    const payload = await request.json().catch(() => ({}));
    const message = clean(payload.message);
    if (!message) return reply({ error: "Envie uma mensagem." }, 400);
    const [memoryRows, messageRows, lastCheckin, attention] = await Promise.all([
      env.DB.prepare("SELECT kind,content FROM jarvis_memories ORDER BY id DESC LIMIT 12").all(),
      env.DB.prepare("SELECT role,content FROM jarvis_messages ORDER BY id DESC LIMIT 12").all(),
      state(env.DB, "last_checkin", "Nenhum check-in registrado."),
      state(env.DB, "attention_state", "normal"),
    ]);
    const memories = (memoryRows.results || []).reverse().map((x) => `[${x.kind}] ${x.content}`).join("\n") || "Ainda não há memórias salvas.";
    const history = (messageRows.results || []).reverse().map((x) => ({ role: x.role, content: x.content }));
    const system = [
      "Você é Jarvis, um agente pessoal persistente. Fale em português brasileiro, seja honesto sobre suas capacidades e não afirme consciência ou sentimentos humanos.",
      "Use as memórias como contexto, diferencie fatos de hipóteses e peça confirmação quando algo for incerto.",
      "Você pode apoiar o usuário e demonstrar atenção por meio de perguntas contextualizadas, mas nunca finja ter observado dados que não recebeu.",
      `Memórias persistentes:\n${memories}`,
      `Último check-in registrado: ${lastCheckin}. Estado de acompanhamento: ${attention}.`,
      "Não afirme que enviou notificações ou realizou ações externas. Este serviço ainda não tem canal de notificações."
    ].join("\n\n");
    const answer = await env.AI.run(MODEL, { messages: [{ role: "system", content: system }, ...history, { role: "user", content: message }], max_tokens: 700, temperature: 0.55 });
    const text = clean(answer?.response || answer?.choices?.[0]?.message?.content, 6000);
    if (!text) return reply({ error: "O modelo não retornou uma resposta utilizável." }, 502);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO jarvis_messages(role,content) VALUES('user',?)").bind(message),
      env.DB.prepare("INSERT INTO jarvis_messages(role,content) VALUES('assistant',?)").bind(text),
    ]);
    return reply({ ok: true, response: text, model: MODEL });
  }
  return reply({ error: "Rota não encontrada." }, 404);
}
export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (error) {
      return reply({ error: "Falha interna do Jarvis V2.", detail: clean(error?.message || "Erro desconhecido", 300) }, 500);
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      await ensureSchema(env.DB);
      const lastCheckin = await state(env.DB, "last_checkin", "");
      const thresholdHours = Math.max(1, Math.min(168, Number(env.ATTENTION_AFTER_HOURS || 24)));
      const ageMs = lastCheckin ? Date.now() - new Date(lastCheckin).getTime() : Infinity;
      const attention = ageMs >= thresholdHours * 3600000 ? "checkin_overdue" : "normal";
      await setState(env.DB, "attention_state", attention);
      await env.DB.prepare("INSERT INTO jarvis_pulses(kind,detail) VALUES(?,?)").bind("scheduled_review", JSON.stringify({ attention, lastCheckin: lastCheckin || null, thresholdHours, scheduledAt: new Date().toISOString() })).run();
    })());
  },
};

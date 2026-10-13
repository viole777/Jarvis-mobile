import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IndependentCognitiveEngine, CognitiveStateStore, SelfModelStore } from "./brain/cognitive/index.js";
import { deriveSelfModel } from "./brain/cognitive/self-model.js";
import { AIsaModelClient } from "./brain/aisa-model.js";
import { listSkills, loadSkills, skillsSystemMessage } from "./skills/registry.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const AUTH_TOKEN = process.env.JARVIS_AUTH_TOKEN || "";
const store = new CognitiveStateStore();
const self = new SelfModelStore();
const engine = new IndependentCognitiveEngine();
const aisa = new AIsaModelClient();
const requestCounts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_CHAT_REQUESTS_PER_WINDOW = 30;
const MAX_BODY_BYTES = 1024 * 1024;

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": process.env.JARVIS_CORS_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  res.end(data);
}

function auth(req) {
  return !AUTH_TOKEN || req.headers.authorization === `Bearer ${AUTH_TOKEN}`;
}

function requireAgentAuth(req, res) {
  if (!AUTH_TOKEN) {
    json(res, 503, { error: "Agente indisponível: configure JARVIS_AUTH_TOKEN no ambiente do servidor antes de habilitar o chat." });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${AUTH_TOKEN}`) {
    json(res, 401, { error: "Não autorizado. Configure o token de acesso do Jarvis na sessão do navegador." });
    return false;
  }
  return true;
}

async function body(req) {
  let data = "";
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Corpo da solicitação excede 1 MB."), { statusCode: 413 });
    data += chunk;
  }
  try {
    return JSON.parse(data || "{}");
  } catch {
    throw Object.assign(new Error("JSON inválido."), { statusCode: 400 });
  }
}

function rateLimit(req, res) {
  const now = Date.now();
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  const record = requestCounts.get(ip);
  if (!record || now - record.startedAt >= WINDOW_MS) {
    requestCounts.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  if (record.count >= MAX_CHAT_REQUESTS_PER_WINDOW) {
    json(res, 429, { error: "Limite temporário atingido. Aguarde alguns minutos antes de tentar novamente." });
    return false;
  }
  record.count++;
  return true;
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    throw Object.assign(new Error("Envie de 1 a 40 mensagens."), { statusCode: 400 });
  }
  return messages;
}

async function handleSetupAisa(req, res) {
  if (!requireAgentAuth(req, res)) return;
  if (!rateLimit(req, res)) return;
  const input = await body(req);
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  const model = typeof input.model === "string" ? input.model.trim() : "";
  if (apiKey.length < 16 || apiKey.length > 4096 || /\\s/.test(apiKey)) {
    return json(res, 400, { error: "A chave parece inválida. Verifique o valor e tente novamente." });
  }
  const selectedModel = model || aisa.model || process.env.AISA_MODEL || "";
  if (!selectedModel || selectedModel.length > 200) {
    return json(res, 400, { error: "Chave recebida com segurança, mas falta o ID do modelo. Informe um modelo habilitado na sua conta AIsa." });
  }
  aisa.configure({ apiKey, model: selectedModel });
  return json(res, 200, {
    ok: true,
    configured: aisa.isConfigured(),
    persistence: "memory_until_server_restart",
    message: "AIsa configurada em memória. Para persistir após reinícios, configure AISA_API_KEY no gerenciador de segredos do servidor."
  });
}

async function handleChat(req, res) {
  if (!requireAgentAuth(req, res)) return;
  if (!rateLimit(req, res)) return;
  const input = await body(req);
  const messages = validateMessages(input.messages);
  const result = await aisa.complete({ messages, tools: [] });
  return json(res, 200, { ok: true, text: result.text, model: result.model, fallbackUsed: Boolean(result.fallbackUsed), usage: result.usage });
}

async function handleAgent(req, res) {
  if (!requireAgentAuth(req, res)) return;
  if (!rateLimit(req, res)) return;
  const input = await body(req);
  const messages = validateMessages(input.messages);
  const tools = Array.isArray(input.tools) ? input.tools.slice(0, 32) : [];
  const selectedSkills = loadSkills(input.skills);
  const skillPrompt = skillsSystemMessage(selectedSkills);
  const agentMessages = skillPrompt
    ? [{ role: "system", content: skillPrompt }, ...messages].slice(-39)
    : messages;
  const result = await aisa.complete({ messages: agentMessages, tools });
  return json(res, 200, { ...result, skillsUsed: selectedSkills.map((skill) => skill.id) });
}

async function observe(req, res) {
  if (!auth(req)) return json(res, 401, { error: "Unauthorized" });
  const input = await body(req);
  const id = String(input.subjectId || "default").slice(0, 120);
  const observation = String(input.observation || input.event || "").trim().slice(0, 12000);
  if (!observation) return json(res, 400, { error: "observation is required" });
  const cognitiveState = engine.evaluate({
    previousState: store.get(id),
    observations: [{ content: observation }],
    context: { subjectId: id, selfModel: self.get(id) }
  });
  store.set(id, cognitiveState);
  const selfModel = self.set(id, deriveSelfModel(cognitiveState, self.get(id)));
  return json(res, 200, { ok: true, observation, cognitiveState, selfModel });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/") {
      const file = path.join(ROOT, "index.html");
      if (fs.existsSync(file)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return fs.createReadStream(file).pipe(res);
      }
      return json(res, 200, { ok: true, name: "Jarvis V1", status: "online" });
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "jarvis-server", aisaConfigured: aisa.isConfigured() });
    }
    if (req.method === "GET" && url.pathname === "/v1/skills") {
      if (!requireAgentAuth(req, res)) return;
      return json(res, 200, { ok: true, skills: listSkills(), skillFormat: "server/skills/<skill-id>/SKILL.md" });
    }
    if (req.method === "POST" && url.pathname === "/v1/setup/aisa") return await handleSetupAisa(req, res);
    if (req.method === "POST" && url.pathname === "/v1/chat") return await handleChat(req, res);
    if (req.method === "POST" && url.pathname === "/v1/agent") return await handleAgent(req, res);
    if (req.method === "GET" && url.pathname === "/v1/cognitive/state") {
      if (!auth(req)) return json(res, 401, { error: "Unauthorized" });
      const id = String(url.searchParams.get("subjectId") || "default").slice(0, 120);
      return json(res, 200, { ok: true, cognitiveState: store.get(id), selfModel: self.get(id) });
    }
    if (req.method === "POST" && url.pathname === "/v1/cognitive/observe") return await observe(req, res);
    if (req.method === "POST" && url.pathname === "/v1/cognitive/reset") {
      if (!auth(req)) return json(res, 401, { error: "Unauthorized" });
      const input = await body(req);
      const id = String(input.subjectId || "default").slice(0, 120);
      store.clear(id);
      self.clear(id);
      return json(res, 200, { ok: true, subjectId: id });
    }
    return json(res, 404, { error: "Not found" });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    if (status >= 500) console.error("Request failed:", String(error?.message || "unknown error").slice(0, 300));
    return json(res, status, { error: status >= 500 ? (error.message || "Erro interno do Jarvis.") : error.message });
  }
});

server.listen(PORT, HOST, () => console.log(`Jarvis server listening on http://${HOST}:${PORT}`));

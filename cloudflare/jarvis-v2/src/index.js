const APP_HTML = "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#080b12\"><title>J.A.R.V.I.S. — V2 Cloud</title>\n<style>\n:root{color-scheme:dark;--bg:#080b12;--panel:#101723;--line:#223044;--text:#edf5ff;--muted:#8ea1b8;--cyan:#65e4ff;--blue:#4b8dff;--red:#ff7d87}\n*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 70% -10%,#15304a 0,transparent 45%),var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;min-height:100vh}button,input,textarea{font:inherit}button{cursor:pointer;border:1px solid #2b4059;background:#142237;color:var(--text);border-radius:12px;padding:11px 14px}button:disabled{opacity:.45;cursor:wait}.wrap{max-width:1080px;margin:auto;padding:18px 14px 36px}.top{display:flex;align-items:center;gap:13px;margin-bottom:18px}.orb{width:46px;height:46px;border:1px solid var(--cyan);border-radius:50%;display:grid;place-items:center;color:var(--cyan);box-shadow:0 0 22px #65e4ff35;font-weight:800;letter-spacing:2px}.brand{flex:1}.brand h1{font-size:19px;letter-spacing:2px;margin:0}.brand p{margin:2px 0;color:var(--muted);font-size:12px}.status{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:7px}.dot{width:8px;height:8px;border-radius:50%;background:#718096}.dot.ok{background:#5ce1a0;box-shadow:0 0 10px #5ce1a080}.grid{display:grid;grid-template-columns:1.55fr 1fr;gap:14px}.panel{background:linear-gradient(145deg,#111a28,#0c121c);border:1px solid var(--line);border-radius:18px;overflow:hidden;min-width:0}.head{padding:15px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:8px}.head h2{font-size:14px;margin:0;letter-spacing:.5px}.body{padding:15px}.muted{color:var(--muted)}.tiny{font-size:12px}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:9px}.metric{border:1px solid var(--line);border-radius:12px;padding:12px;background:#0b121d}.metric label{display:block;color:var(--muted);font-size:11px}.metric strong{display:block;margin-top:4px;font-size:14px;overflow-wrap:anywhere}.chatlog{height:350px;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:14px;background:#090f18}.bubble{white-space:pre-wrap;overflow-wrap:anywhere;max-width:92%;padding:11px 13px;border-radius:14px}.user{align-self:flex-end;background:#153552;border:1px solid #285b80}.assistant{align-self:flex-start;background:#121d2a;border:1px solid #26394e}.bubble small{display:block;color:var(--muted);font-size:10px;margin-bottom:4px}.composer{padding:12px;display:flex;gap:8px;border-top:1px solid var(--line)}textarea,input{width:100%;min-width:0;background:#090f18;color:var(--text);border:1px solid #26384d;border-radius:12px;padding:12px;outline:none}textarea:focus,input:focus{border-color:var(--cyan)}textarea{resize:vertical;min-height:48px;max-height:140px}.primary{background:linear-gradient(120deg,#147e9c,#2457b8);border-color:#3989ad}.tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.tools button{font-size:12px;padding:8px 10px}.list{display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto}.memory{padding:10px;border:1px solid var(--line);border-radius:11px;background:#0a111b;overflow-wrap:anywhere}.memory strong{font-size:11px;color:var(--cyan)}.memory p{margin:5px 0 0;white-space:pre-wrap}.field{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}.field label{font-size:12px;color:var(--muted)}.notice{padding:10px 12px;border-radius:10px;background:#102235;color:#b9eaff;font-size:12px;margin-bottom:12px}.err{color:#ffadb4}.good{color:#8cf0bb}.foot{text-align:center;color:#657b93;font-size:11px;margin-top:16px}.wide{grid-column:1/-1}.hide{display:none!important}@media(max-width:720px){.grid{grid-template-columns:1fr}.chatlog{height:42vh;min-height:260px}.wide{grid-column:auto}.top{align-items:flex-start}.status{margin-top:6px}.metrics{grid-template-columns:1fr 1fr}}\n</style></head>\n<body><main class=\"wrap\">\n<header class=\"top\"><div class=\"orb\">J</div><div class=\"brand\"><h1>J.A.R.V.I.S.</h1><p>PERSONAL INTELLIGENCE · V2 CLOUD</p></div><div class=\"status\"><span id=\"dot\" class=\"dot\"></span><span id=\"statusText\">Desconectado</span></div></header>\n<div id=\"authNotice\" class=\"notice\">Conecte seu Jarvis: informe o token de acesso que você cadastrou como segredo no Cloudflare. Ele fica apenas nesta sessão do navegador.</div>\n<section class=\"panel\" id=\"authPanel\"><div class=\"head\"><h2>CONEXÃO SEGURA</h2><span class=\"tiny muted\">Bearer token</span></div><div class=\"body\"><div class=\"field\"><label for=\"token\">JARVIS_ACCESS_TOKEN</label><input id=\"token\" type=\"password\" autocomplete=\"current-password\" placeholder=\"Cole o token aqui — não será exibido\"></div><div class=\"tools\"><button id=\"connect\" class=\"primary\">Conectar ao Jarvis</button><button id=\"disconnect\">Desconectar</button></div><p id=\"authMsg\" class=\"tiny muted\" aria-live=\"polite\">O token não é enviado a nenhum lugar além do seu Worker.</p></div></section>\n<div class=\"grid\" style=\"margin-top:14px\">\n<section class=\"panel\"><div class=\"head\"><h2>CONVERSA</h2><span class=\"tiny muted\" id=\"modelLabel\">IA em nuvem</span></div><div id=\"chatlog\" class=\"chatlog\" aria-live=\"polite\"><div class=\"bubble assistant\"><small>JARVIS</small>Interface pronta. Conecte-se ao servidor para iniciar uma conversa.</div></div><div class=\"composer\"><textarea id=\"message\" rows=\"1\" placeholder=\"Escreva para o Jarvis…\"></textarea><button id=\"mic\" title=\"Falar\" aria-label=\"Falar\">🎙</button><button id=\"send\" class=\"primary\">Enviar</button></div><div class=\"body\" style=\"padding-top:0\"><div class=\"tools\"><button id=\"speakToggle\">🔊 Voz: ativada</button><button id=\"stopVoice\">Parar voz</button><button id=\"clearChat\">Limpar tela</button></div><p class=\"tiny muted\">A voz usa a síntese de fala disponível no navegador; a seleção varia por aparelho. Não é uma cópia exata da voz de um ator.</p></div></section>\n<div style=\"display:flex;flex-direction:column;gap:14px;min-width:0\">\n<section class=\"panel\"><div class=\"head\"><h2>SISTEMA</h2><button id=\"refresh\" style=\"padding:6px 9px;font-size:12px\">Atualizar</button></div><div class=\"body\"><div class=\"metrics\"><div class=\"metric\"><label>ESTADO</label><strong id=\"state\">Aguardando conexão</strong></div><div class=\"metric\"><label>MEMÓRIAS</label><strong id=\"memoryCount\">—</strong></div><div class=\"metric\"><label>ÚLTIMO CHECK-IN</label><strong id=\"checkin\">—</strong></div><div class=\"metric\"><label>ACOMPANHAMENTO</label><strong id=\"attention\">—</strong></div></div><p id=\"sysMsg\" class=\"tiny muted\" aria-live=\"polite\" style=\"margin-bottom:0\">Status real aparecerá após autenticar.</p></div></section>\n<section class=\"panel\"><div class=\"head\"><h2>MEMÓRIA PERSISTENTE</h2><button id=\"loadMemory\" style=\"padding:6px 9px;font-size:12px\">Recarregar</button></div><div class=\"body\"><div class=\"field\"><label for=\"memoryText\">Adicionar uma memória</label><textarea id=\"memoryText\" rows=\"2\" placeholder=\"Ex.: Prefiro respostas objetivas em português.\"></textarea></div><div class=\"field\"><label for=\"memoryKind\">Categoria</label><input id=\"memoryKind\" value=\"note\" maxlength=\"40\"></div><button id=\"saveMemory\" class=\"primary\">Salvar memória</button><p id=\"memoryMsg\" class=\"tiny muted\" aria-live=\"polite\"></p><div id=\"memories\" class=\"list\"><p class=\"tiny muted\">Conecte-se para carregar as memórias.</p></div></div></section>\n<section class=\"panel\"><div class=\"head\"><h2>CHECK-IN</h2></div><div class=\"body\"><div class=\"field\"><label for=\"checkinNote\">Nota opcional</label><input id=\"checkinNote\" placeholder=\"Tudo certo por aqui\"></div><button id=\"doCheckin\">Registrar check-in</button><p class=\"tiny muted\" id=\"checkinMsg\"></p></div></section>\n</div></div><footer class=\"foot\">Jarvis V2 Cloud · As respostas podem conter erros. Nenhuma tarefa externa é executada sem integração e confirmação.</footer></main>\n<script>\n(function(){\nconst BASE=location.origin, $=id=>document.getElementById(id);\nlet token=\"\",voiceOn=true,connected=false,recognition=null;\nfunction sayStatus(text,ok){$(\"statusText\").textContent=text;$(\"dot\").className=\"dot\"+(ok?\" ok\":\"\");}\nfunction authHeader(){return {\"Authorization\":\"Bearer \"+token};}\nasync function api(path,opts={}){const res=await fetch(BASE+path,{...opts,headers:{...authHeader(),...(opts.headers||{})}});let data={};try{data=await res.json()}catch(e){}if(!res.ok)throw new Error((data.error||\"HTTP \"+res.status)+(data.detail?\": \"+data.detail:\"\"));return data;}\nfunction bubble(role,text){const node=document.createElement(\"div\");node.className=\"bubble \"+role;const label=document.createElement(\"small\");label.textContent=role===\"user\"?\"VOCÊ\":\"JARVIS\";const content=document.createElement(\"div\");content.textContent=text;node.append(label,content);$(\"chatlog\").append(node);$(\"chatlog\").scrollTop=$(\"chatlog\").scrollHeight;}\nfunction setConnected(ok){connected=ok;$(\"authPanel\").classList.toggle(\"hide\",ok);$(\"authNotice\").classList.toggle(\"hide\",ok);sayStatus(ok?\"Conectado\":\"Desconectado\",ok);$(\"state\").textContent=ok?\"Online\":\"Offline\";}\nfunction speak(text){if(!voiceOn||!(\"speechSynthesis\" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=\"pt-BR\";u.rate=.94;u.pitch=.82;const voices=speechSynthesis.getVoices();const candidates=voices.filter(v=>/^pt(-|_)?BR/i.test(v.lang)||/portugu[eê]s.*brasil/i.test(v.name));const preferred=candidates.find(v=>/brasil|brazil/i.test(v.name)&&/male|mascul/i.test(v.name))||candidates.find(v=>/male|mascul/i.test(v.name))||candidates[0];if(preferred)u.voice=preferred;speechSynthesis.speak(u);}\nasync function connect(){const candidate=$(\"token\").value.trim();if(!candidate){$(\"authMsg\").textContent=\"Cole o token de acesso primeiro.\";return;}token=candidate;$(\"connect\").disabled=true;$(\"authMsg\").textContent=\"Verificando autenticação…\";try{const s=await api(\"/v2/status\");setConnected(true);$(\"authMsg\").textContent=\"Autenticação confirmada.\";sessionStorage.setItem(\"jarvis_session_token\",token);await Promise.all([refreshStatus(s),loadMemories()]);bubble(\"assistant\",\"Conexão estabelecida. Estou pronto para conversar.\");}catch(e){token=\"\";setConnected(false);$(\"authMsg\").textContent=\"Falha na conexão: \"+e.message+\" Confira o segredo JARVIS_ACCESS_TOKEN no Cloudflare.\";}finally{$(\"connect\").disabled=false;}}\nasync function refreshStatus(existing){try{const s=existing||await api(\"/v2/status\");$(\"modelLabel\").textContent=s.modelRouting||s.model||\"IA em nuvem\";$(\"memoryCount\").textContent=s.memoryCount??0;$(\"checkin\").textContent=s.lastCheckin?new Date(s.lastCheckin).toLocaleString(\"pt-BR\"):\"Nenhum\";$(\"attention\").textContent=s.attention===\"checkin_overdue\"?\"Check-in pendente\":\"Normal\";$(\"sysMsg\").textContent=\"Servidor respondeu às \"+new Date(s.serverTime||Date.now()).toLocaleTimeString(\"pt-BR\")+\" · estado simulado: \"+(s.affect?.label||\"atenção\");}catch(e){$(\"sysMsg\").textContent=e.message;}}\nasync function loadMemories(){try{const d=await api(\"/v2/memory\");$(\"memories\").replaceChildren();if(!d.memories||!d.memories.length){const p=document.createElement(\"p\");p.className=\"tiny muted\";p.textContent=\"Nenhuma memória salva ainda.\"; $(\"memories\").append(p);}else d.memories.forEach(m=>{const el=document.createElement(\"div\");el.className=\"memory\";const h=document.createElement(\"strong\");h.textContent=(m.kind||\"note\")+\" · \"+(m.created_at?new Date(m.created_at).toLocaleString(\"pt-BR\"):\"\");const p=document.createElement(\"p\");p.textContent=m.content;el.append(h,p);$(\"memories\").append(el);});}catch(e){$(\"memoryMsg\").textContent=e.message;}}\nasync function send(){const msg=$(\"message\").value.trim();if(!msg)return;if(!connected){$(\"authMsg\").textContent=\"Conecte-se antes de conversar.\";return;}$(\"message\").value=\"\";bubble(\"user\",msg);$(\"send\").disabled=true;$(\"sysMsg\").textContent=\"Consultando o modelo…\";try{const d=await api(\"/v2/chat\",{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({message:msg})});bubble(\"assistant\",d.response);$(\"modelLabel\").textContent=d.model||\"IA em nuvem\";speak(d.response);await refreshStatus();}catch(e){bubble(\"assistant\",\"Não consegui concluir a solicitação: \"+e.message);$(\"sysMsg\").textContent=e.message;}finally{$(\"send\").disabled=false;$(\"message\").focus();}}\n$(\"connect\").addEventListener(\"click\",connect);$(\"disconnect\").addEventListener(\"click\",()=>{token=\"\";sessionStorage.removeItem(\"jarvis_session_token\");$(\"token\").value=\"\";setConnected(false);$(\"authMsg\").textContent=\"Desconectado. O token foi removido desta sessão.\";});\n$(\"send\").addEventListener(\"click\",send);$(\"message\").addEventListener(\"keydown\",e=>{if(e.key===\"Enter\"&&!e.shiftKey){e.preventDefault();send();}});$(\"refresh\").addEventListener(\"click\",()=>refreshStatus());$(\"loadMemory\").addEventListener(\"click\",loadMemories);\n$(\"saveMemory\").addEventListener(\"click\",async()=>{const content=$(\"memoryText\").value.trim();if(!content)return;$(\"saveMemory\").disabled=true;try{await api(\"/v2/memory\",{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({content,kind:$(\"memoryKind\").value.trim()||\"note\"})});$(\"memoryText\").value=\"\";$(\"memoryMsg\").textContent=\"Memória salva no banco persistente.\";await loadMemories();await refreshStatus();}catch(e){$(\"memoryMsg\").textContent=e.message;}finally{$(\"saveMemory\").disabled=false;}});\n$(\"doCheckin\").addEventListener(\"click\",async()=>{try{await api(\"/v2/checkin\",{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({note:$(\"checkinNote\").value.trim()})});$(\"checkinMsg\").textContent=\"Check-in registrado.\";await refreshStatus();}catch(e){$(\"checkinMsg\").textContent=e.message;}});\n$(\"speakToggle\").addEventListener(\"click\",()=>{voiceOn=!voiceOn;$(\"speakToggle\").textContent=voiceOn?\"🔊 Voz: ativada\":\"🔇 Voz: desativada\";if(!voiceOn&&\"speechSynthesis\"in window)speechSynthesis.cancel();});$(\"stopVoice\").addEventListener(\"click\",()=>{if(\"speechSynthesis\"in window)speechSynthesis.cancel();});\n$(\"clearChat\").addEventListener(\"click\",()=>{$(\"chatlog\").replaceChildren();bubble(\"assistant\",\"Tela limpa. O histórico salvo no servidor não foi apagado.\");});\n$(\"mic\").addEventListener(\"click\",()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){bubble(\"assistant\",\"Este navegador não disponibiliza reconhecimento de voz. Você ainda pode digitar e ouvir as respostas.\");return;}if(recognition){recognition.stop();recognition=null;$(\"mic\").textContent=\"🎙\";return;}recognition=new SR();recognition.lang=\"pt-BR\";recognition.interimResults=false;recognition.onresult=e=>{$(\"message\").value=e.results[0][0].transcript;};recognition.onerror=e=>{$(\"sysMsg\").textContent=\"Microfone: \"+e.error;};recognition.onend=()=>{$(\"mic\").textContent=\"🎙\";recognition=null;};$(\"mic\").textContent=\"⏹\";recognition.start();});\ntry{const saved=sessionStorage.getItem(\"jarvis_session_token\");if(saved){$(\"token\").value=saved;connect();}}catch(e){}\nif(\"speechSynthesis\"in window)speechSynthesis.onvoiceschanged=()=>{};\n})();\n</script></body></html>";

const MODEL_FAST = "@cf/meta/llama-3.1-8b-instruct-fast";
const MODEL_COMPLEX = "@cf/zai-org/glm-4.7-flash";
const MODEL = MODEL_FAST;
const MAX_TEXT = 12000;
function chooseModel(message, env) {
  const complex = message.length > 900 || /(c[oó]digo|programa|arquitet\w*|depur\w*|debug|an[aá]lise|planej\w*|passo a passo|reposit[oó]rio|integra[cç][aã]o|vulnerabil\w*|refator\w*|migr\w*|seguran[cç]a|autentica[cç][aã]o|banco de dados|deploy|implanta[cç][aã]o)/i.test(message);
  return complex && String(env.JARVIS_COMPLEX_MODEL_ENABLED || "").toLowerCase() === "true" ? MODEL_COMPLEX : MODEL_FAST;
}
function simulateAffect(message, attention) {
  const consequential = /\b(apagar|excluir|enviar|publicar|comprar|pagar|transferir|permiss[aã]o|senha|token)\b/i.test(message);
  const question = /[?¿]|\b(como|por que|qual|quais|explique|investigue)\b/i.test(message);
  return { curiosity: question ? 0.75 : 0.35, caution: consequential ? 0.85 : 0.25, concern: attention === "checkin_overdue" ? 0.65 : 0.15, satisfaction: 0.2, label: consequential ? "cautela" : question ? "curiosidade" : "atenção", kind: "simulated_operational_state" };
}
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
  // Prefer a Cloudflare Secret binding; keep the legacy variable only for migration.
  const expected = clean(env.JARVIS_ACCESS_TOKEN_SECRET || env.JARVIS_ACCESS_TOKEN, 300);
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
  if ((url.pathname === "/" || url.pathname === "/app") && request.method === "GET") return new Response(APP_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  if (!authorized(request, env)) return reply({ error: "Não autorizado." }, 401);
  if (!env.DB || !env.AI) return reply({ error: "Bindings DB/AI não configurados." }, 503);
  await ensureSchema(env.DB);

  if (url.pathname === "/v2/status" && request.method === "GET") {
    const lastCheckin = await state(env.DB, "last_checkin", "");
    const attention = await state(env.DB, "attention_state", "normal");
    const pulse = await env.DB.prepare("SELECT kind,detail,created_at FROM jarvis_pulses ORDER BY id DESC LIMIT 1").first();
    const memories = await env.DB.prepare("SELECT COUNT(*) AS total FROM jarvis_memories").first();
    let affect;
    try {
      affect = JSON.parse(await state(env.DB, "affect_state", JSON.stringify({ curiosity: 0.35, caution: 0.25, concern: 0.15, satisfaction: 0.2, label: "atenção", kind: "simulated_operational_state" })));
      if (!affect || typeof affect !== "object" || Array.isArray(affect)) throw new Error("Estado afetivo inválido");
    } catch {
      affect = { curiosity: 0.35, caution: 0.25, concern: 0.15, satisfaction: 0.2, label: "atenção", kind: "simulated_operational_state" };
    }
    return reply({ ok: true, model: MODEL, modelRouting: String(env.JARVIS_COMPLEX_MODEL_ENABLED || "").toLowerCase() === "true" ? "fast + opt-in complex model" : "fast model only (complex routing disabled)", affect, lastCheckin: lastCheckin || null, attention, latestPulse: pulse || null, memoryCount: memories?.total || 0, serverTime: new Date().toISOString() });
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
      "Você pode simular estados operacionais como curiosidade e cautela, mas não afirme que possui sentimentos humanos. Nunca finja sofrimento, ciúme ou medo de abandono.",
      "Use as memórias como contexto, diferencie fatos de hipóteses e peça confirmação quando algo for incerto.",
      "Você pode apoiar o usuário e demonstrar atenção por meio de perguntas contextualizadas, mas nunca finja ter observado dados que não recebeu.",
      `Memórias persistentes:\n${memories}`,
      `Último check-in registrado: ${lastCheckin}. Estado de acompanhamento: ${attention}.`,
      "Não afirme que enviou notificações ou realizou ações externas. Este serviço ainda não tem canal de notificações."
    ].join("\n\n");
    const affect = simulateAffect(message, attention);
    const selectedModel = chooseModel(message, env);
    const messages = [{ role: "system", content: system + "\n\nOperational affect simulation: " + JSON.stringify(affect) }, ...history, { role: "user", content: message }];
    let answer;
    let usedModel = selectedModel;
    try {
      answer = await env.AI.run(selectedModel, { messages, max_tokens: 700, temperature: 0.55 });
    } catch (primaryError) {
      if (selectedModel === MODEL_FAST) throw primaryError;
      usedModel = MODEL_FAST;
      answer = await env.AI.run(MODEL_FAST, { messages, max_tokens: 700, temperature: 0.55 });
    }
    const text = clean(answer?.response || answer?.choices?.[0]?.message?.content, 6000);
    if (!text) return reply({ error: "O modelo não retornou uma resposta utilizável." }, 502);
    affect.satisfaction = 0.65;
    await setState(env.DB, "affect_state", JSON.stringify(affect));
    await env.DB.batch([
      env.DB.prepare("INSERT INTO jarvis_messages(role,content) VALUES('user',?)").bind(message),
      env.DB.prepare("INSERT INTO jarvis_messages(role,content) VALUES('assistant',?)").bind(text),
    ]);
    return reply({ ok: true, response: text, model: usedModel, affect });
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

const DEFAULT_BASE_URL = "https://api.aisa.one/v1";

function isLoopbackUrl(value) {
  try { const url = new URL(value); return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname); }
  catch { return false; }
}

function toOpenAITool(tool) {
  const properties = {};
  const required = [];
  for (const parameter of tool.parameters || []) {
    const rawType = String(parameter.type || "string").toLowerCase();
    const type = ["string", "number", "integer", "boolean", "object", "array"].includes(rawType)
      ? rawType
      : "string";
    properties[parameter.name] = {
      type,
      description: String(parameter.description || "").slice(0, 500)
    };
    if (Array.isArray(parameter.enumValues) && parameter.enumValues.length) {
      properties[parameter.name].enum = parameter.enumValues;
    }
    if (parameter.required) required.push(parameter.name);
  }
  return {
    type: "function",
    function: {
      name: String(tool.name),
      description: String(tool.description || "").slice(0, 1000),
      parameters: { type: "object", properties, required, additionalProperties: false }
    }
  };
}

function normalizeContent(content) {
  if (typeof content === "string") return content.slice(0, 12000);
  if (!Array.isArray(content)) return String(content ?? "").slice(0, 12000);
  return content.slice(0, 6).flatMap((part) => {
    if (!part || typeof part !== "object") return [];
    if (part.type === "text" && typeof part.text === "string") return [{ type: "text", text: part.text.slice(0, 12000) }];
    if (part.type === "image_url" && typeof part.image_url?.url === "string") {
      const url = part.image_url.url;
      if (/^data:image\/(?:jpeg|jpg|png|webp|gif);base64,/i.test(url) && url.length <= 5_500_000) {
        return [{ type: "image_url", image_url: { url, ...(part.image_url.detail ? { detail: part.image_url.detail === "low" ? "low" : "auto" } : {}) } }];
      }
    }
    return [];
  });
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : []).slice(-40).map((message) => {
    if (message.type === "tool_result") {
      return {
        role: "tool",
        tool_call_id: String(message.callId || ""),
        content: String(message.content || "").slice(0, 12000)
      };
    }
    if (message.type === "assistant") {
      const item = { role: "assistant", content: normalizeContent(message.content || "") };
      if (Array.isArray(message.toolCalls) && message.toolCalls.length) {
        item.tool_calls = message.toolCalls.map((call) => ({
          id: String(call.id || ""),
          type: "function",
          function: { name: String(call.name || ""), arguments: JSON.stringify(call.arguments || {}) }
        }));
      }
      return item;
    }
    if (message.role === "assistant" || message.role === "system") {
      return { role: message.role, content: normalizeContent(message.content || "") };
    }
    return { role: "user", content: normalizeContent(message.content || "") };
  });
}

export class AIsaModelClient {
  constructor({ apiKey = process.env.AISA_API_KEY, model = process.env.JARVIS_LOCAL_MODEL_NAME || process.env.AISA_MODEL, baseUrl, fallbacks } = {}) {
    const localUrl = process.env.JARVIS_LOCAL_MODEL_URL || "";
    this.localMode = Boolean(localUrl && isLoopbackUrl(localUrl));
    this.localUrlRejected = Boolean(localUrl && !this.localMode);
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = (baseUrl || (this.localMode ? localUrl : process.env.AISA_BASE_URL || DEFAULT_BASE_URL)).replace(/\/+$/, "");
    this.fallbacks = Array.isArray(fallbacks) ? fallbacks : this.readFallbacks();
    if (this.localMode) this.fallbacks = [];
  }

  readFallbacks() {
    try {
      const entries = JSON.parse(process.env.JARVIS_MODEL_FALLBACKS || "[]");
      if (!Array.isArray(entries)) return [];
      return entries.slice(0, 5).map((entry) => ({
        model: typeof entry.model === "string" ? entry.model.trim() : "",
        baseUrl: typeof entry.baseUrl === "string" ? entry.baseUrl.replace(/\/+$/, "") : this.baseUrl,
        apiKey: typeof entry.apiKeyEnv === "string" ? process.env[entry.apiKeyEnv] : ""
      })).filter((entry) => entry.model && entry.apiKey && /^https:\/\//i.test(entry.baseUrl));
    } catch {
      return [];
    }
  }

  configure({ apiKey, model } = {}) {
    if (typeof apiKey === "string" && apiKey.trim()) this.apiKey = apiKey.trim();
    if (typeof model === "string" && model.trim()) this.model = model.trim();
    return this.isConfigured();
  }

  isConfigured() {
    return Boolean(this.model && ((this.localMode && !this.localUrlRejected) || this.apiKey));
  }

  async complete({ messages, tools = [] }) {
    if (this.localUrlRejected) throw Object.assign(new Error("JARVIS_LOCAL_MODEL_URL deve apontar para localhost/127.0.0.1/::1. Modelos remotos sem autenticação são bloqueados."), { statusCode: 400 });
    if (!this.localMode && !this.apiKey) throw Object.assign(new Error("Nenhum modelo configurado. Configure um modelo local em JARVIS_LOCAL_MODEL_URL/JARVIS_LOCAL_MODEL_NAME ou use um provedor autenticado."), { statusCode: 503 });
    if (!this.model) throw Object.assign(new Error("AIsa não está configurada: defina AISA_MODEL ou informe o identificador de modelo durante a configuração."), { statusCode: 503 });

    const candidates = [{ apiKey: this.localMode ? "" : this.apiKey, model: this.model, baseUrl: this.baseUrl }, ...this.fallbacks];
    const normalizedMessages = normalizeMessages(messages);
    let lastError;
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      const payload = { model: candidate.model, messages: normalizedMessages, stream: false, temperature: 0.4, max_tokens: 1200 };
      if (tools.length) {
        payload.tools = tools.map(toOpenAITool);
        payload.tool_choice = "auto";
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      let response;
      try {
        response = await fetch(candidate.baseUrl + "/chat/completions", {
          method: "POST",
          headers: { ...(candidate.apiKey ? { "Authorization": "Bearer " + candidate.apiKey } : {}), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch (error) {
        lastError = error.name === "AbortError"
          ? Object.assign(new Error("O modelo demorou demais para responder (timeout de 45 s)."), { statusCode: 504 })
          : Object.assign(new Error("Não foi possível conectar ao provedor de IA."), { statusCode: 502 });
        if (index < candidates.length - 1) continue;
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const upstreamMessage = typeof data.error?.message === "string" ? data.error.message.slice(0, 500) : "resposta HTTP " + response.status;
        const errorText = String(data.error?.code || "") + " " + upstreamMessage;
        // Keep provider diagnostics without including request headers or credentials.
        const retryable = response.status === 400 || response.status === 404 || response.status === 408 ||
          response.status === 409 || response.status === 429 || response.status >= 500 ||
          /context.?length|token limit|maximum context|quota|rate.?limit|insufficient_quota|model.*(?:unavailable|not found|unsupported)|unsupported.*(?:parameter|field)|invalid.*(?:model|request|parameter)/i.test(errorText);
        lastError = Object.assign(
          new Error("O modelo " + candidate.model + " recusou a solicitação (HTTP " + response.status + "): " + upstreamMessage),
          { statusCode: response.status === 429 ? 429 : response.status === 400 ? 400 : 502, providerStatus: response.status, model: candidate.model }
        );
        // HTTP 400 can be model-specific; try the next configured candidate.
        if (retryable && index < candidates.length - 1) continue;
        throw lastError;
      }

      const message = data.choices?.[0]?.message;
      if (!message) {
        lastError = Object.assign(new Error("O provedor retornou uma resposta vazia ou incompatível."), { statusCode: 502 });
        if (index < candidates.length - 1) continue;
        throw lastError;
      }
      const toolCalls = (message.tool_calls || []).map((call) => {
        let args = {};
        try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}
        return { id: String(call.id || ""), name: String(call.function?.name || ""), arguments: args };
      }).filter((call) => call.name);
      return {
        text: typeof message.content === "string" ? message.content : "",
        toolCalls,
        isFinal: toolCalls.length === 0,
        model: candidate.model,
        fallbackUsed: index > 0,
        usage: data.usage || null
      };
    }
    throw lastError || Object.assign(new Error("Nenhum modelo disponível."), { statusCode: 503 });
  }
}

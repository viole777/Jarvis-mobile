const DEFAULT_BASE_URL = "https://api.aisa.one/v1";

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
      const item = { role: "assistant", content: String(message.content || "") };
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
      return { role: message.role, content: String(message.content || "").slice(0, 12000) };
    }
    return { role: "user", content: String(message.content || "").slice(0, 12000) };
  });
}

export class AIsaModelClient {
  constructor({ apiKey = process.env.AISA_API_KEY, model = process.env.AISA_MODEL, baseUrl = process.env.AISA_BASE_URL || DEFAULT_BASE_URL } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\\/+$/, "");
  }

  configure({ apiKey, model } = {}) {
    if (typeof apiKey === "string" && apiKey.trim()) this.apiKey = apiKey.trim();
    if (typeof model === "string" && model.trim()) this.model = model.trim();
    return this.isConfigured();
  }

  isConfigured() {
    return Boolean(this.apiKey && this.model);
  }

  async complete({ messages, tools = [] }) {
    if (!this.apiKey) throw Object.assign(new Error("AIsa não está configurada: defina AISA_API_KEY no servidor ou use a configuração segura do Jarvis."), { statusCode: 503 });
    if (!this.model) throw Object.assign(new Error("AIsa não está configurada: defina AISA_MODEL ou informe o identificador de modelo durante a configuração."), { statusCode: 503 });

    const payload = {
      model: this.model,
      messages: normalizeMessages(messages),
      stream: false,
      temperature: 0.4,
      max_tokens: 1200
    };
    if (tools.length) {
      payload.tools = tools.map(toOpenAITool);
      payload.tool_choice = "auto";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response;
    try {
      response = await fetch(this.baseUrl + "/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === "AbortError") throw Object.assign(new Error("AIsa demorou demais para responder (timeout de 45 s)."), { statusCode: 504 });
      throw Object.assign(new Error("Não foi possível conectar à API da AIsa."), { statusCode: 502 });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const upstreamMessage = typeof data.error?.message === "string" ? data.error.message.slice(0, 500) : "resposta HTTP " + response.status;
      const error = new Error("AIsa recusou a solicitação: " + upstreamMessage);
      error.statusCode = response.status === 429 ? 429 : 502;
      throw error;
    }

    const message = data.choices?.[0]?.message;
    if (!message) throw Object.assign(new Error("AIsa retornou uma resposta vazia ou incompatível."), { statusCode: 502 });
    const toolCalls = (message.tool_calls || []).map((call) => {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}
      return { id: String(call.id || ""), name: String(call.function?.name || ""), arguments: args };
    }).filter((call) => call.name);

    return {
      text: typeof message.content === "string" ? message.content : "",
      toolCalls,
      isFinal: toolCalls.length === 0,
      model: this.model,
      usage: data.usage || null
    };
  }
}

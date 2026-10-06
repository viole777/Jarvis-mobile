export function interpretRequest(input) {
  const text = String(input || "").trim();
  const lower = text.toLowerCase();
  const actionWords = ["abra", "clique", "digite", "envie", "apague", "instale", "pesquise", "procure", "execute", "faça"];
  const needsAction = actionWords.some(word => lower.includes(word));
  const question = /^(como|por que|porque|qual|quem|quando|onde|o que|quanto|é|e se)\b/i.test(text);
  return {
    objective: text,
    intent: needsAction ? "tool_action" : question ? "question_answering" : "conversation",
    constraints: [],
    entities: [],
    requiredInformation: [],
    knownInformation: [],
    unknownInformation: [],
    urgency: "normal",
    riskLevel: needsAction ? "unknown" : "low",
    expectedOutput: "natural_language",
    needsTool: needsAction
  };
}

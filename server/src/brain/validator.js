export function validateResult({ objective, text, toolCalls = [], errors = [] }) {
  const hasResult = Boolean(String(text || "").trim()) || toolCalls.length > 0;
  return {
    completed: errors.length === 0 && hasResult,
    missing: hasResult ? [] : ["result"],
    contradictions: [],
    confidence: errors.length ? "low" : hasResult ? "medium" : "low",
    objective
  };
}

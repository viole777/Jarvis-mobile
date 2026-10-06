export function validateResult({ objective, text, toolCalls = [], errors = [] }) {
  const finalText = String(text || "").trim();
  const completed = errors.length === 0 && toolCalls.length === 0 && finalText.length > 0;
  return {
    completed,
    missing: completed ? [] : ["final_response"],
    contradictions: [],
    confidence: errors.length ? "low" : completed ? "medium" : "low",
    objective
  };
}

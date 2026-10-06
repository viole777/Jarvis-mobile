const LEVELS = ["low", "medium", "high"];

export function createCognitiveState(seed = {}) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    situationSummary: seed.situationSummary || "",
    beliefs: Array.isArray(seed.beliefs) ? seed.beliefs.slice(0, 20) : [],
    hypotheses: Array.isArray(seed.hypotheses) ? seed.hypotheses.slice(0, 12) : [],
    goals: Array.isArray(seed.goals) ? seed.goals.slice(0, 12) : [],
    attention: Array.isArray(seed.attention) ? seed.attention.slice(0, 12) : [],
    uncertainty: LEVELS.includes(seed.uncertainty) ? seed.uncertainty : "medium",
    concern: LEVELS.includes(seed.concern) ? seed.concern : "low",
    curiosity: LEVELS.includes(seed.curiosity) ? seed.curiosity : "low",
    confidence: LEVELS.includes(seed.confidence) ? seed.confidence : "medium",
    urgency: LEVELS.includes(seed.urgency) ? seed.urgency : "low",
    recommendedAction: seed.recommendedAction || "observe",
    reason: seed.reason || "",
    lastObservationAt: seed.lastObservationAt || null
  };
}

export function mergeCognitiveState(previous, next = {}) {
  const base = createCognitiveState(previous || {});
  const merged = createCognitiveState({ ...base, ...next });
  merged.updatedAt = new Date().toISOString();
  return merged;
}

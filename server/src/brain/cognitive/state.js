const LEVELS = ["low", "medium", "high"];

export function createCognitiveState(seed = {}) {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    situationSummary: seed.situationSummary || "",
    beliefs: Array.isArray(seed.beliefs) ? seed.beliefs.slice(-20) : [],
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
    intent: seed.intent || null,
    unknowns: Array.isArray(seed.unknowns) ? seed.unknowns.slice(0, 10) : [],
    candidateActions: Array.isArray(seed.candidateActions) ? seed.candidateActions.slice(0, 8) : [],
    principlesApplied: Array.isArray(seed.principlesApplied) ? seed.principlesApplied.slice(0, 10) : [],
    reasoningTrace: Array.isArray(seed.reasoningTrace) ? seed.reasoningTrace.slice(0, 12) : [],
    lastObservationAt: seed.lastObservationAt || null
  };
}

export function mergeCognitiveState(previous, next = {}) {
  const base = createCognitiveState(previous || {});
  const merged = createCognitiveState({ ...base, ...next });
  merged.updatedAt = new Date().toISOString();
  return merged;
}

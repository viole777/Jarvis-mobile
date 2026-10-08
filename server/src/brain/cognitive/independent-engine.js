import { createCognitiveState, mergeCognitiveState } from "./state.js";

const WORDS = {
  concern: ["danger", "risk", "failed", "missing", "unexpected", "error", "lost", "blocked", "offline"],
  curiosity: ["unknown", "why", "new", "changed", "different", "unexpected", "unclear"],
  urgency: ["critical", "urgent", "immediately", "now", "attack", "breach", "down"]
};

function score(text, words) {
  const lower = text.toLowerCase();
  return words.reduce((n, word) => n + (lower.includes(word) ? 1 : 0), 0);
}

function level(value) {
  if (value >= 3) return "high";
  if (value >= 1) return "medium";
  return "low";
}

function normalizeObservation(observation) {
  return String(observation?.content || observation || "").trim().slice(0, 2000);
}

function extractEntities(text) {
  const entities = [];
  for (const match of text.matchAll(/\b(?:device|server|phone|computer|user|system|service|application|app)\b/gi)) {
    entities.push(match[0].toLowerCase());
  }
  return [...new Set(entities)].slice(0, 12);
}

export class IndependentCognitiveEngine {
  evaluate({ previousState, observations = [], context = {} }) {
    const state = createCognitiveState(previousState || {});
    const current = observations.slice(-20).map(normalizeObservation).filter(Boolean);
    const latest = current.at(-1) || "";
    const previousSummary = state.situationSummary || "";
    const changed = Boolean(previousSummary && latest && latest !== previousSummary);

    const concernScore = score(latest, WORDS.concern) + (changed ? 1 : 0);
    const curiosityScore = score(latest, WORDS.curiosity) + (changed ? 1 : 0);
    const urgencyScore = score(latest, WORDS.urgency);
    const uncertaintyScore = latest.length < 20 || /unknown|unclear|uncertain|don't know|nao sei|não sei/i.test(latest) ? 2 : 0;

    const hypotheses = [{
      statement: changed
        ? "The current observation represents a change from the previous state."
        : "The current observation is consistent with the available state.",
      confidence: changed ? "medium" : "low",
      evidenceFor: latest ? [latest] : [],
      evidenceAgainst: []
    }];

    if (uncertaintyScore > 0) hypotheses.push({
      statement: "More evidence is required before committing to a strong conclusion.",
      confidence: "high",
      evidenceFor: ["The available observation is incomplete or explicitly uncertain."],
      evidenceAgainst: []
    });

    const action = urgencyScore >= 2 || concernScore >= 2 ? "investigate"
      : curiosityScore >= 2 ? "observe"
      : "respond";

    return mergeCognitiveState(state, {
      situationSummary: latest || previousSummary,
      beliefs: [...(state.beliefs || []).slice(-8), ...(latest ? [latest] : [])].slice(-20),
      hypotheses: hypotheses.slice(0, 12),
      goals: [
        "maintain a coherent representation of the current situation",
        ...(action === "investigate" ? ["reduce uncertainty with proportional evidence"] : [])
      ],
      attention: extractEntities(latest),
      uncertainty: level(uncertaintyScore + (changed ? 1 : 0)),
      concern: level(concernScore),
      curiosity: level(curiosityScore),
      confidence: latest.length >= 80 && uncertaintyScore === 0 ? "medium" : "low",
      urgency: level(urgencyScore),
      recommendedAction: action,
      reason: changed
        ? "The engine detected a change and selected an action based on observable evidence and uncertainty."
        : "The engine evaluated the available observation without assuming facts that were not provided.",
      lastObservationAt: new Date().toISOString(),
      metadata: {
        engine: "independent-bootstrap-v1",
        subjectId: String(context.subjectId || "default"),
        entities: extractEntities(latest)
      }
    });
  }
}

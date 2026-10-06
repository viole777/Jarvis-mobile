import { createCognitiveState, mergeCognitiveState } from "./state.js";

const COGNITIVE_PROMPT = [
  "You are the cognitive evaluator inside Jarvis.",
  "Your job is to evaluate the current situation, not to roleplay a human mind.",
  "Infer beliefs, competing hypotheses, uncertainty, concern, curiosity, confidence, urgency, attention and the next useful action from evidence.",
  "Do not invent observations. Distinguish observed facts from hypotheses.",
  "Concern is an internal functional state used to prioritize investigation; it is not proof that danger exists.",
  "Do not escalate because of a single ambiguous signal. Prefer gathering evidence and proportional actions.",
  "Do not execute tools from this step. Return only JSON.",
  "",
  "Return exactly this JSON shape:",
  "{",
  '  "situationSummary": "string",',
  '  "beliefs": ["observed or well-supported statements"],',
  '  "hypotheses": [{"statement":"string","confidence":"low|medium|high","evidenceFor":["string"],"evidenceAgainst":["string"]}],',
  '  "goals": ["current useful goals"],',
  '  "attention": ["what deserves attention now"],',
  '  "uncertainty": "low|medium|high",',
  '  "concern": "low|medium|high",',
  '  "curiosity": "low|medium|high",',
  '  "confidence": "low|medium|high",',
  '  "urgency": "low|medium|high",',
  '  "recommendedAction": "observe|respond|investigate|plan|act|wait|ask",',
  '  "reason": "short explanation grounded in evidence"',
  "}"
].join("\n");

function extractJson(text) {
  const raw = String(text || "").trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return {
    situationSummary: String(snapshot.situationSummary || "").slice(0, 2000),
    beliefs: Array.isArray(snapshot.beliefs) ? snapshot.beliefs.map(String).slice(0, 20) : [],
    hypotheses: Array.isArray(snapshot.hypotheses)
      ? snapshot.hypotheses.slice(0, 12).map(item => ({
          statement: String(item?.statement || "").slice(0, 500),
          confidence: ["low", "medium", "high"].includes(item?.confidence) ? item.confidence : "low",
          evidenceFor: Array.isArray(item?.evidenceFor) ? item.evidenceFor.map(String).slice(0, 8) : [],
          evidenceAgainst: Array.isArray(item?.evidenceAgainst) ? item.evidenceAgainst.map(String).slice(0, 8) : []
        }))
      : [],
    goals: Array.isArray(snapshot.goals) ? snapshot.goals.map(String).slice(0, 12) : [],
    attention: Array.isArray(snapshot.attention) ? snapshot.attention.map(String).slice(0, 12) : [],
    uncertainty: snapshot.uncertainty,
    concern: snapshot.concern,
    curiosity: snapshot.curiosity,
    confidence: snapshot.confidence,
    urgency: snapshot.urgency,
    recommendedAction: String(snapshot.recommendedAction || "observe"),
    reason: String(snapshot.reason || "").slice(0, 2000)
  };
}

export class CognitiveEngine {
  constructor({ model }) {
    this.model = model;
  }

  async evaluate({ previousState, observations = [], context = {} }) {
    const state = createCognitiveState(previousState || {});
    const payload = {
      previousState: state,
      observations: observations.slice(-20),
      context
    };

    const result = await this.model.call([
      {
        type: "user",
        content: COGNITIVE_PROMPT + "\n\nCURRENT INPUT:\n" + JSON.stringify(payload)
      }
    ], []);

    const parsed = normalizeSnapshot(extractJson(result?.text));
    if (!parsed) {
      return mergeCognitiveState(state, {
        situationSummary: "Cognitive evaluation returned an unusable structured result.",
        uncertainty: "high",
        confidence: "low",
        recommendedAction: "observe",
        reason: "The evaluator could not produce a valid cognitive snapshot."
      });
    }

    return mergeCognitiveState(state, {
      ...parsed,
      lastObservationAt: new Date().toISOString()
    });
  }
}

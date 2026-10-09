import { createCognitiveState, mergeCognitiveState } from "./state.js";
import { PRINCIPLES, RULES, REASONING_PROTOCOL } from "./reasoning-knowledge.js";

const WORDS = {
  concern: ["danger", "risk", "failed", "missing", "unexpected", "error", "lost", "blocked", "offline", "erro", "falha", "perigo", "risco", "bloqueado"],
  curiosity: ["unknown", "why", "new", "changed", "different", "unexpected", "unclear", "por que", "como", "qual", "o que", "entender", "descobrir"],
  urgency: ["critical", "urgent", "immediately", "now", "attack", "breach", "down", "urgente", "imediatamente", "agora", "ataque", "invasão", "invasao"]
};
function score(text, words) { const lower = text.toLocaleLowerCase("pt-BR"); return words.reduce((n, word) => n + (lower.includes(word) ? 1 : 0), 0); }
function level(value) { if (value >= 3) return "high"; if (value >= 1) return "medium"; return "low"; }
function normalizeObservation(observation) { return String(observation?.content || observation || "").trim().slice(0, 2000); }
function extractEntities(text) {
  const matches = text.match(/(?:[\p{L}\p{N}_-]{3,})/gu) || [];
  const stop = new Set(["que", "para", "com", "uma", "uns", "por", "the", "and", "you", "your", "this", "that", "estou", "quero", "preciso", "sobre", "como", "isso", "esta", "está"]);
  return [...new Set(matches.map(x => x.toLocaleLowerCase("pt-BR")).filter(x => !stop.has(x)))].slice(0, 12);
}
function matchIntent(text) { return RULES.find(rule => rule.when.test(text)) || null; }
function selectPrinciples(intent, changed, uncertain, hasToolAction) {
  const wanted = new Set(["evidence-first", "uncertainty", "explainability"]);
  if (changed) wanted.add("contradiction");
  if (uncertain) wanted.add("specificity");
  if (intent) wanted.add("scope");
  if (hasToolAction) { wanted.add("preconditions"); wanted.add("user-control"); wanted.add("capability-honesty"); }
  if (intent?.intent === "make_plan") wanted.add("goal-decomposition");
  if (intent?.intent === "compare_options") wanted.add("alternative-hypotheses");
  if (intent?.intent === "debug_problem") wanted.add("feedback-loop");
  return PRINCIPLES.filter(p => wanted.has(p.id));
}
function makeHypotheses(latest, previousSummary, changed, intent, uncertainty) {
  const hs = [];
  if (intent) hs.push({
    statement: "Likely user intent: " + intent.goal + ".",
    confidence: "medium",
    evidenceFor: [latest],
    evidenceAgainst: ["Intent classification is based on language patterns, not a full semantic model."]
  });
  hs.push({
    statement: changed ? "The latest input differs from the previous observation." : "There is no confirmed change from a previous observation.",
    confidence: changed ? "medium" : "low",
    evidenceFor: latest ? [latest] : [],
    evidenceAgainst: previousSummary && latest === previousSummary ? [previousSummary] : []
  });
  if (uncertainty) hs.push({
    statement: "The available input does not establish every fact needed to complete the goal.",
    confidence: "high",
    evidenceFor: [intent?.limitation || "The engine has limited semantic and tool capabilities."],
    evidenceAgainst: []
  });
  return hs.slice(0, 12);
}
export class IndependentCognitiveEngine {
  evaluate({ previousState, observations = [], context = {} }) {
    const state = createCognitiveState(previousState || {});
    const current = observations.slice(-20).map(normalizeObservation).filter(Boolean);
    const latest = current.at(-1) || "";
    const previousSummary = state.situationSummary || "";
    const changed = Boolean(previousSummary && latest && latest !== previousSummary);
    const intent = matchIntent(latest);
    const concernScore = score(latest, WORDS.concern) + (changed ? 1 : 0);
    const curiosityScore = score(latest, WORDS.curiosity) + (changed ? 1 : 0);
    const urgencyScore = score(latest, WORDS.urgency);
    const explicitUncertainty = /(?:não sei|nao sei|não tenho certeza|nao tenho certeza|talvez|incerto|incerta|unknown|unclear|uncertain|not sure)/i.test(latest);
    const shortInput = latest.length < 20;
    const uncertaintyScore = (shortInput ? 1 : 0) + (explicitUncertainty ? 2 : 0) + (!intent && latest.includes("?") ? 1 : 0);
    const uncertain = uncertaintyScore > 0 || Boolean(intent?.limitation);
    const principles = selectPrinciples(intent, changed, uncertain, Boolean(intent?.action));
    const unknowns = [];
    if (intent?.preconditions?.length) unknowns.push(...intent.preconditions.map(p => "Confirmar: " + p + "."));
    if (intent?.limitation) unknowns.push(intent.limitation);
    if (!intent) unknowns.push("A intenção não foi classificada com confiança suficiente; pedir uma pergunta ou objetivo mais específico.");
    const candidateActions = [
      { action: intent?.action || "ask_targeted_question", reason: intent ? "Corresponde ao objetivo provável identificado." : "A intenção permanece ambígua.", viable: Boolean(intent) },
      { action: "ask_targeted_question", reason: "Pode reduzir a incerteza antes de agir.", viable: uncertain },
      { action: "claim_task_completed", reason: "Não há evidência de execução de uma ferramenta.", viable: false }
    ];
    const chosen = candidateActions.find(a => a.viable) || candidateActions[1];
    const trace = [
      "1. Entrada: " + (latest || "(vazia)"),
      "2. Intenção provável: " + (intent ? intent.intent + " — " + intent.goal : "não identificada"),
      "3. Evidência direta: a mensagem do usuário é a única evidência usada nesta avaliação.",
      "4. Incertezas: " + (unknowns.length ? unknowns.join(" ") : "nenhuma limitação específica detectada; a interpretação ainda é provisória."),
      "5. Princípios aplicados: " + (principles.map(p => p.id).join(", ") || "evidence-first"),
      "6. Ações avaliadas: " + candidateActions.map(a => a.action + (a.viable ? " [viável]" : " [rejeitada: " + a.reason + "]")).join("; "),
      "7. Escolha atual: " + chosen.action + " — " + chosen.reason,
      "8. Próximo passo: " + (intent?.limitation || (intent?.preconditions?.length ? intent.preconditions.join("; ") : "solicitar evidência de resultado antes de afirmar conclusão.")),
      "Nota: isto é raciocínio simbólico heurístico e rastreável, não prova de consciência nem um modelo neural treinado."
    ];
    const action = intent ? intent.action : (urgencyScore >= 2 || concernScore >= 2 ? "investigate" : curiosityScore >= 2 ? "observe" : "ask_targeted_question");
    return mergeCognitiveState(state, {
      situationSummary: latest || previousSummary,
      beliefs: [...(state.beliefs || []).slice(-8), ...(latest ? [latest] : [])].slice(-20),
      hypotheses: makeHypotheses(latest, previousSummary, changed, intent, uncertain),
      goals: [intent?.goal || "clarify the user's goal", "reduce uncertainty using observable evidence"],
      attention: extractEntities(latest),
      uncertainty: level(uncertaintyScore + (changed ? 1 : 0) + (intent?.limitation ? 1 : 0)),
      concern: level(concernScore),
      curiosity: level(curiosityScore),
      confidence: intent && !uncertain && latest.length >= 40 ? "medium" : "low",
      urgency: level(urgencyScore),
      recommendedAction: action,
      reason: intent
        ? "Intent rule '" + intent.id + "' matched. The engine selected a candidate action after checking prerequisites and capability limits."
        : "No intent rule matched reliably; the engine avoided inventing an answer and selected clarification.",
      intent: intent ? { id: intent.id, name: intent.intent, goal: intent.goal, action: intent.action, preconditions: intent.preconditions, limitation: intent.limitation } : null,
      unknowns,
      candidateActions,
      principlesApplied: principles.map(p => ({ id: p.id, text: p.text })),
      reasoningTrace: trace.slice(0, Math.min(REASONING_PROTOCOL.length + 1, 12)),
      lastObservationAt: new Date().toISOString(),
      metadata: {
        engine: "independent-symbolic-reasoner-v1",
        subjectId: String(context.subjectId || "default"),
        entities: extractEntities(latest),
        knowledgePrinciples: PRINCIPLES.length,
        intentRules: RULES.length
      }
    });
  }
}

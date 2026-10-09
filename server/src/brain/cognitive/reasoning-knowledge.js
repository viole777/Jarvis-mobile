// Compact symbolic knowledge for the Jarvis bootstrap reasoner.
// This is executable structured knowledge, not a trained neural model.
export const PRINCIPLES = [
  { id: "evidence-first", text: "Distinguish direct observations from assumptions; do not state an assumption as a fact.", tags: ["epistemology", "confidence"] },
  { id: "uncertainty", text: "When evidence is incomplete, preserve uncertainty and ask for the missing information.", tags: ["epistemology", "clarification"] },
  { id: "alternative-hypotheses", text: "Compare at least one plausible alternative before committing when several explanations fit.", tags: ["hypothesis", "comparison"] },
  { id: "causality", text: "Temporal order alone does not prove causation; seek a mechanism or additional evidence.", tags: ["causality"] },
  { id: "contradiction", text: "When new evidence conflicts with a belief, mark the conflict and revise confidence rather than ignoring it.", tags: ["belief-revision"] },
  { id: "goal-decomposition", text: "Turn a broad goal into smaller actions with observable completion conditions.", tags: ["planning"] },
  { id: "preconditions", text: "Before an action, check its prerequisites, permissions, and available tools.", tags: ["planning", "tools", "safety"] },
  { id: "capability-honesty", text: "Never claim to have performed an action unless a tool returned evidence that it succeeded.", tags: ["tools", "honesty"] },
  { id: "least-action", text: "Choose the least invasive action that can satisfy the user's stated goal.", tags: ["planning", "safety"] },
  { id: "reversibility", text: "Prefer reversible actions before destructive or irreversible ones.", tags: ["planning", "safety"] },
  { id: "user-control", text: "Actions involving private device data, microphone, camera, or screen require explicit user-mediated permission.", tags: ["privacy", "tools"] },
  { id: "tool-boundary", text: "If a required tool is unavailable, explain the limitation and offer the closest valid next step.", tags: ["tools"] },
  { id: "feedback-loop", text: "After acting, inspect the result; success or failure should update the next decision.", tags: ["learning", "control"] },
  { id: "specificity", text: "Prefer a specific, testable next question over a generic request for more context.", tags: ["dialogue"] },
  { id: "repetition", text: "Repeated input without new evidence should not be treated as independent confirmation.", tags: ["evidence"] },
  { id: "recency", text: "Use recent observations for current state while retaining older facts only when relevant.", tags: ["memory"] },
  { id: "scope", text: "Separate what the user asked from adjacent tasks that were not requested.", tags: ["intent"] },
  { id: "privacy-minimization", text: "Collect or transmit only the data needed for the requested task.", tags: ["privacy"] },
  { id: "risk-proportionality", text: "Increase verification as the potential harm or irreversibility of an action increases.", tags: ["safety", "planning"] },
  { id: "explainability", text: "Record evidence, assumptions, uncertainty, chosen action, and a reason for the decision.", tags: ["metacognition"] },
  { id: "learning-from-error", text: "Treat failed actions as evidence about the method, not proof that the goal is impossible.", tags: ["learning"] },
  { id: "testable-claims", text: "Prefer claims that can be checked against an observable result.", tags: ["verification"] },
  { id: "resource-awareness", text: "Check whether the available environment has the capability, permissions, and resources required.", tags: ["planning"] },
  { id: "ambiguity", text: "If a phrase supports materially different interpretations, clarify before taking a consequential action.", tags: ["intent", "safety"] }
];

export const RULES = [
  { id: "screen-capture", when: /(?:print|captura(?:r)?|screenshot|foto).{0,35}(?:tela|ecrã|screen)|(?:tela|ecrã|screen).{0,35}(?:print|captura|screenshot)/i, intent: "capture_screen", goal: "Capture or inspect the user's current screen", action: "request_user_screen_permission", preconditions: ["browser screen-capture API is available", "user explicitly selects a screen/window/tab"], limitation: "A web page cannot silently capture the screen; visual interpretation is not implemented in this beta." },
  { id: "image-analysis", when: /(?:analisa|analisar|descreve|descrever|o que tem|o que aparece).{0,40}(?:imagem|foto|print|figura)/i, intent: "analyze_image", goal: "Interpret visual content", action: "request_visual_input", preconditions: ["image data is available", "a visual-analysis capability exists"], limitation: "The current beta can preview an image but has no visual analysis engine." },
  { id: "debug", when: /(?:erro|bug|falha|não funciona|nao funciona|quebrou|crash|deploy)/i, intent: "debug_problem", goal: "Identify the cause of a reported technical problem", action: "gather_diagnostic_evidence", preconditions: ["reproduction steps or logs are available"], limitation: "A cause cannot be confirmed from a symptom alone." },
  { id: "learn", when: /(?:ensina|aprender|estudar|explique|explica|como funciona|o que é|o que e)/i, intent: "learn_or_explain", goal: "Build an accurate explanation", action: "identify_question_and_evidence", preconditions: ["the topic or question can be identified"], limitation: "The bootstrap reasoner has limited stored domain knowledge." },
  { id: "plan", when: /(?:planeja|planejar|plano|organiza|organizar|passo a passo|como faço|como faco)/i, intent: "make_plan", goal: "Decompose a goal into verifiable steps", action: "decompose_goal", preconditions: ["goal and constraints are sufficiently clear"], limitation: "Plans must be checked against real environment state before execution." },
  { id: "compare", when: /(?:compar|diferença|diferenca|melhor entre|versus|vs\.?)/i, intent: "compare_options", goal: "Compare options against explicit criteria", action: "identify_criteria_and_evidence", preconditions: ["at least two options or alternatives are named"], limitation: "A ranking is unreliable when criteria or evidence are missing." },
  { id: "security", when: /(?:vulnerabilidade|segurança|seguranca|hacking|invasão|invasao|exploit|ataque)/i, intent: "security_analysis", goal: "Assess a security question or weakness", action: "scope_and_verify", preconditions: ["target and authorized scope are defined for any live test"], limitation: "Do not infer authorization or technical impact from a keyword alone." },
  { id: "question", when: /[?¿]|^(?:quem|quando|onde|por que|porque|como|qual|quais|quanto|quantos|what|why|how|when|where|who)\b/i, intent: "answer_question", goal: "Answer the user's explicit question", action: "identify_required_facts", preconditions: ["the question is sufficiently specific"], limitation: "If required facts are not available, ask a targeted clarification." }
];

export const REASONING_PROTOCOL = [
  "Parse the user's likely goal and preserve the original input as evidence.",
  "Retrieve matching principles and intent rules; do not treat a keyword match as proof of full understanding.",
  "Separate observed facts, inferred claims, and unknowns.",
  "Check prerequisites, available tools, permission boundaries, and capability limits.",
  "Generate a small set of candidate next actions and reject candidates whose prerequisites are unmet.",
  "Choose a proportionate next action; ask a targeted question when ambiguity blocks safe progress.",
  "State the reason and uncertainty, then update the cognitive state.",
  "After tool execution, use its result as new evidence and revise the plan."
];

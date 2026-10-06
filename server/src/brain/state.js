export const RUN_STATES = Object.freeze({
  CREATED: "created", INTERPRETING: "interpreting", PLANNING: "planning",
  EXECUTING: "executing", OBSERVING: "observing", VALIDATING: "validating",
  WAITING_CONFIRMATION: "waiting_confirmation", COMPLETED: "completed",
  FAILED: "failed", CANCELLED: "cancelled"
});
export function createAgentRun(userInput) {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), traceId: crypto.randomUUID(), userInput,
    objective: null, complexity: 0, status: RUN_STATES.CREATED, plan: [],\n    cognitiveState: null,
    currentStep: null, context: {}, toolCalls: [], observations: [], errors: [],
    result: null, createdAt: now, startedAt: null, completedAt: null };
}
export function transitionRun(run, status) {
  run.status = status;
  if (status === RUN_STATES.INTERPRETING && !run.startedAt) run.startedAt = new Date().toISOString();
  if ([RUN_STATES.COMPLETED, RUN_STATES.FAILED, RUN_STATES.CANCELLED].includes(status))
    run.completedAt = new Date().toISOString();
  return run;
}

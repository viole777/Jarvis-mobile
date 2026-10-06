export function createPlan(interpretation, tools = []) {
  const step = {
    id: crypto.randomUUID(),
    index: 0,
    objective: interpretation.objective,
    type: interpretation.needsTool ? "tool_action" : "response",
    toolOptional: interpretation.needsTool,
    dependencies: [],
    status: "ready",
    result: null
  };
  return { objective: interpretation.objective, steps: [step], adaptive: true, availableToolCount: tools.length };
}

export function adaptPlan(plan, observation) {
  if (!plan) return plan;
  if (observation?.status === "failure" && plan.steps[0]) {
    plan.steps[0].status = "needs_alternative";
  }
  return plan;
}

export function createSelfModel(seed = {}) {
  return {
    version: 1,
    identity: "Jarvis",
    capabilities: Array.isArray(seed.capabilities) ? seed.capabilities.slice(0, 50) : [],
    limitations: Array.isArray(seed.limitations) ? seed.limitations.slice(0, 50) : [],
    goals: Array.isArray(seed.goals) ? seed.goals.slice(0, 20) : [],
    beliefs: Array.isArray(seed.beliefs) ? seed.beliefs.slice(0, 30) : [],
    uncertainties: Array.isArray(seed.uncertainties) ? seed.uncertainties.slice(0, 30) : [],
    activeHypotheses: Array.isArray(seed.activeHypotheses) ? seed.activeHypotheses.slice(0, 20) : [],
    recentActions: Array.isArray(seed.recentActions) ? seed.recentActions.slice(-20) : [],
    recentResults: Array.isArray(seed.recentResults) ? seed.recentResults.slice(-20) : [],
    updatedAt: new Date().toISOString()
  };
}

export function mergeSelfModel(previous, next = {}) {
  const base = createSelfModel(previous || {});
  return createSelfModel({
    ...base,
    ...next,
    updatedAt: new Date().toISOString()
  });
}

export function deriveSelfModel(cognitiveState, previous = {}) {
  const state = cognitiveState || {};
  return mergeSelfModel(previous, {
    goals: Array.isArray(state.goals) ? state.goals : previous.goals,
    beliefs: Array.isArray(state.beliefs) ? state.beliefs : previous.beliefs,
    activeHypotheses: Array.isArray(state.hypotheses) ? state.hypotheses : previous.activeHypotheses,
    uncertainties: state.uncertainty ? [
      `Current uncertainty: ${state.uncertainty}`
    ] : previous.uncertainties
  });
}

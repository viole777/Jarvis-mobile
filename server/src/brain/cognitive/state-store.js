import { createCognitiveState, mergeCognitiveState } from "./state.js";

export class CognitiveStateStore {
  constructor() {
    this.states = new Map();
  }

  get(subjectId = "default") {
    return createCognitiveState(this.states.get(String(subjectId)));
  }

  set(subjectId = "default", state) {
    const key = String(subjectId);
    const next = mergeCognitiveState(this.states.get(key), state);
    this.states.set(key, next);
    return createCognitiveState(next);
  }

  observe(subjectId = "default", observation) {
    const current = this.get(subjectId);
    return this.set(subjectId, {
      beliefs: [...current.beliefs, String(observation)].slice(-20),
      lastObservationAt: new Date().toISOString()
    });
  }

  clear(subjectId = "default") {
    return this.states.delete(String(subjectId));
  }
}

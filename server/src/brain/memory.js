export class MemoryManager {
  constructor() { this.working = new Map(); }
  start(runId, seed = {}) {
    this.working.set(runId, { runId, facts: [], observations: [], hypotheses: [], ...seed });
    return this.get(runId);
  }
  get(runId) { return this.working.get(runId) || null; }
  addObservation(runId, observation) {
    const memory = this.working.get(runId); if (!memory) return null;
    memory.observations.push(observation); return memory;
  }
  clear(runId) { this.working.delete(runId); }
}

export class PerceptionEngine {
  constructor({ cognitiveCore, now = () => new Date() }) {
    if (!cognitiveCore || typeof cognitiveCore.ingestObservation !== "function") {
      throw new Error("A cognitiveCore with ingestObservation() is required.");
    }
    this.cognitiveCore = cognitiveCore;
    this.now = now;
  }

  observe(input) {
    if (!input?.subjectId || !input?.type) {
      throw new Error("subjectId and type are required.");
    }

    const observation = {
      id: input.id || crypto.randomUUID(),
      subjectId: String(input.subjectId),
      type: String(input.type),
      data: input.data ?? null,
      source: input.source ? String(input.source) : "unknown",
      observedAt: input.observedAt || this.now().toISOString()
    };

    return this.cognitiveCore.ingestObservation(observation);
  }
}

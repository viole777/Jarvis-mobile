export class LearningEngine {
  constructor() { this.experiences = []; }
  record(experience) {
    const item = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      type: experience.type || "run",
      signal: experience.signal || "neutral",
      lesson: String(experience.lesson || "").slice(0, 4000),
      sourceRunId: experience.sourceRunId || null
    };
    if (item.lesson) this.experiences.push(item);
    if (this.experiences.length > 1000) this.experiences.shift();
    return item;
  }
  recent(limit = 20) { return this.experiences.slice(-limit); }
}

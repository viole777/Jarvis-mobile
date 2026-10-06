import { createSelfModel, mergeSelfModel } from "./self-model.js";

export class SelfModelStore {
  constructor() {
    this.models = new Map();
  }

  get(subjectId = "default") {
    return createSelfModel(this.models.get(String(subjectId)));
  }

  set(subjectId = "default", model) {
    const key = String(subjectId);
    const next = mergeSelfModel(this.models.get(key), model);
    this.models.set(key, next);
    return createSelfModel(next);
  }

  recordAction(subjectId, action) {
    const current = this.get(subjectId);
    return this.set(subjectId, {
      recentActions: [...current.recentActions, String(action)].slice(-20)
    });
  }

  recordResult(subjectId, result) {
    const current = this.get(subjectId);
    return this.set(subjectId, {
      recentResults: [...current.recentResults, String(result)].slice(-20)
    });
  }

  clear(subjectId = "default") {
    return this.models.delete(String(subjectId));
  }
}

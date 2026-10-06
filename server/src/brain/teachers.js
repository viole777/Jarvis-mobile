export class TeacherRegistry {
  constructor() { this.teachers = new Map(); }
  register({ id, provider, capabilities = [], enabled = true }) {
    if (!id || !provider) throw new Error("Teacher id and provider are required.");
    this.teachers.set(id, { id, provider, capabilities, enabled });
  }
  list() { return [...this.teachers.values()].filter(t => t.enabled); }
  choose(capability) {
    return this.list().find(t => t.capabilities.includes(capability)) || null;
  }
}

# Jarvis Cloud Brain

The cloud runtime is separated from the model.

Current layers:
- **Orchestrator** owns the bounded AgentRun lifecycle.
- **Interpreter** extracts objective, intent, constraints and risk hints.
- **Planner** creates an explicit adaptive step plan.
- **Critic** performs a lightweight result-quality check.
- **Validator** checks that a run has a usable result before completion.
- **Working Memory** stores per-run context.
- **LearningEngine** records bounded lessons; it does not rewrite production code or model weights.
- **TeacherRegistry** provides a controlled interface for teacher models.

### Teacher principle

Teacher models are instructors, not permanent decision-makers. Their outputs can become training/evaluation data for the Jarvis SLM. A future promotion pipeline must evaluate a candidate model before replacing the current one.

### Self-improvement principle

Self-improvement means a bounded loop:

experience -> evaluation -> lesson/dataset -> candidate training -> evaluation -> optional promotion.

It must never mean unrestricted self-modification, credential access, permission changes, or infinite execution.

### Next layer

1. persistent memory adapter;
2. model router and provider abstraction;
3. tool router + server-side policy;
4. background jobs and resumable runs;
5. teacher -> dataset -> evaluation -> candidate SLM pipeline;
6. proactive monitoring with explicit privacy/consent boundaries.

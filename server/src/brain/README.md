# Jarvis Cloud Brain

This directory is the first cloud-side cognitive runtime for Jarvis.

V1 creates explicit AgentRun state, working memory and bounded orchestration while preserving Android as the execution boundary.

Next layers: interpreter, adaptive planner, observer, validator, model router, persistent memory, critic/reflection, teacher pipeline, background jobs and resumable runs.

The SLM is a model component, not the runtime itself. The runtime must remain usable with a teacher model, the future Jarvis SLM, or another provider.

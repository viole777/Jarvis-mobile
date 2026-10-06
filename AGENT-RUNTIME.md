# Agent Runtime

AgentRun is the unit of autonomous execution.

It tracks id, traceId, userInput, objective, complexity, status, plan, currentStep, context, toolCalls, observations, errors, result and timestamps.

Current V1 execution is bounded by MAX_STEPS and MAX_TOOL_CALLS.

The runtime is provider-agnostic: model calls go through an interface and tools remain external capabilities.

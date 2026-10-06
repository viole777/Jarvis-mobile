import { createAgentRun, RUN_STATES, transitionRun } from "./state.js";
import { interpretRequest } from "./interpreter.js";
import { createPlan } from "./planner.js";
import { critique } from "./critic.js";
import { validateResult } from "./validator.js";

const MAX_STEPS = 12;
const MAX_TOOL_CALLS = 16;

export class Orchestrator {
  constructor({ model, memory }) { this.model = model; this.memory = memory; }

  async run({ messages, tools = [] }) {
    const userInput = messages.at(-1)?.content || "";
    const run = createAgentRun(userInput);
    transitionRun(run, RUN_STATES.INTERPRETING);
    const interpretation = interpretRequest(userInput);
    run.objective = interpretation.objective;
    run.context.interpretation = interpretation;
    run.complexity = interpretation.needsTool ? (tools.length ? 1 : 0) : 0;
    run.plan = createPlan(interpretation, tools).steps;
    this.memory.start(run.id, { inputMessages: messages, interpretation });

    try {
      const result = await this.#loop(run, messages, tools);
      run.result = result;
      const validation = validateResult({
        objective: run.objective,
        text: result.text,
        toolCalls: result.toolCalls,
        errors: run.errors
      });
      run.context.validation = validation;
      if (!validation.completed) throw new Error("Agent result did not satisfy validation.");
      transitionRun(run, RUN_STATES.COMPLETED);
      return { run, ...result };
    } catch (error) {
      run.errors.push({ message: error instanceof Error ? error.message : String(error) });
      transitionRun(run, RUN_STATES.FAILED);
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), { agentRun: run });
    } finally {
      this.memory.clear(run.id);
    }
  }

  async #loop(run, messages, tools) {
    let conversation = [...messages];
    let rounds = 0;

    while (rounds < MAX_STEPS && run.toolCalls.length < MAX_TOOL_CALLS) {
      rounds++;
      run.context.round = rounds;
      transitionRun(run, RUN_STATES.PLANNING);

      const result = await this.model.call(conversation, tools);
      const criticism = critique({
        interpretation: run.context.interpretation,
        result
      });
      run.context.critique = criticism;

      if (result.toolCalls.length === 0) {
        transitionRun(run, RUN_STATES.VALIDATING);
        return { text: result.text || "", toolCalls: [], isFinal: true };
      }

      transitionRun(run, RUN_STATES.EXECUTING);
      for (const call of result.toolCalls) {
        run.currentStep = { index: run.toolCalls.length, tool: call.name };
        run.toolCalls.push(call);
      }

      return { text: result.text || "", toolCalls: result.toolCalls, isFinal: false, agentRun: run };
    }

    throw new Error("Agent execution budget exceeded.");
  }
}

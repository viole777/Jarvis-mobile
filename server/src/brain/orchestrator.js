import { createAgentRun, RUN_STATES, transitionRun } from "./state.js";
import { interpretRequest } from "./interpreter.js";
import { createPlan } from "./planner.js";
import { critique } from "./critic.js";
import { validateResult } from "./validator.js";
import { deriveSelfModel } from "./cognitive/self-model.js";

const MAX_STEPS = 12;
const MAX_TOOL_CALLS = 16;

export class Orchestrator {
  constructor({ model, memory, cognitive, cognitiveStateStore, selfModelStore }) {
    this.model = model; this.memory = memory; this.cognitive = cognitive;
    this.cognitiveStateStore = cognitiveStateStore; this.selfModelStore = selfModelStore;
  }

  async run({ messages, tools = [], subjectId = "default" }) {
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
      const cognitiveState = this.cognitiveStateStore?.get(subjectId);
      const selfModel = this.selfModelStore?.get(subjectId);
      if (this.cognitive) {
        const evaluation = await this.cognitive.evaluate({
          previousState: cognitiveState,
          observations: [{ type: "user_request", content: userInput, timestamp: new Date().toISOString() }],
          context: { subjectId, objective: run.objective, selfModel }
        });
        this.cognitiveStateStore?.set(subjectId, evaluation);
        this.selfModelStore?.set(subjectId, deriveSelfModel(evaluation, selfModel));
        run.context.cognitive = evaluation;
      }

      const result = await this.#loop(run, messages, tools);
      run.result = result;
      const validation = validateResult({ objective: run.objective, text: result.text, toolCalls: result.toolCalls, errors: run.errors });
      run.context.validation = validation;
      if (!validation.completed) throw new Error("Agent result did not satisfy validation.");
      transitionRun(run, RUN_STATES.COMPLETED);
      this.selfModelStore?.recordResult(subjectId, result.text || "tool execution");
      return { run, ...result };
    } catch (error) {
      run.errors.push({ message: error instanceof Error ? error.message : String(error) });
      transitionRun(run, RUN_STATES.FAILED);
      this.selfModelStore?.recordResult(subjectId, `run failed: ${error instanceof Error ? error.message : String(error)}`);
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), { agentRun: run });
    } finally { this.memory.clear(run.id); }
  }

  async #loop(run, messages, tools) {
    let conversation = [...messages]; let rounds = 0;
    while (rounds < MAX_STEPS && run.toolCalls.length < MAX_TOOL_CALLS) {
      rounds++; run.context.round = rounds; transitionRun(run, RUN_STATES.PLANNING);
      const result = await this.model.call(conversation, tools);
      run.context.critique = critique({ interpretation: run.context.interpretation, result });
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

import test from "node:test";
import assert from "node:assert/strict";
import { createSelfModel, deriveSelfModel } from "./self-model.js";

test("self-model preserves identity and derives cognitive state", () => {
  const model = createSelfModel({ capabilities: ["reasoning"] });
  const next = deriveSelfModel({
    goals: ["understand the situation"],
    beliefs: ["the environment changed"],
    hypotheses: [{ statement: "routine changed", confidence: "medium" }],
    uncertainty: "high"
  }, model);

  assert.equal(next.identity, "Jarvis");
  assert.deepEqual(next.goals, ["understand the situation"]);
  assert.deepEqual(next.beliefs, ["the environment changed"]);
  assert.equal(next.activeHypotheses.length, 1);
  assert.match(next.uncertainties[0], /high/i);
});

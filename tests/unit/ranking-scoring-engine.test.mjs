import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFit } from "../../dist/ranking/scoring-engine.js";

function dimensions(overrides = {}) {
  const base = [
    { id: "role", label: "Role", weight: 50, score: 80, evidenceConfidence: "HIGH", evidenceIds: ["ev1"] },
    { id: "skills", label: "Skills", weight: 50, score: 60, evidenceConfidence: "MEDIUM", evidenceIds: ["ev2"] },
  ];
  return base.map((item) => ({ ...item, ...(overrides[item.id] ?? {}) }));
}

test("fit score is a weighted suitability score", () => {
  const result = evaluateFit({
    policyVersion: "test-v1",
    hardGates: [{ id: "eligibility", result: "PASS", reason: "eligible", evidenceIds: [] }],
    dimensions: dimensions(),
  });
  assert.equal(result.hardGate, "PASS");
  assert.equal(result.fitScore, 70);
  assert.equal(result.confidence, "HIGH");
});

test("hard gate FLAG keeps a fit score but remains separately visible", () => {
  const result = evaluateFit({
    policyVersion: "test-v1",
    hardGates: [{ id: "experience", result: "FLAG", reason: "ambiguous wording", evidenceIds: [] }],
    dimensions: dimensions(),
  });
  assert.equal(result.hardGate, "FLAG");
  assert.equal(result.fitScore, 70);
});

test("hard gate FAIL suppresses fit score", () => {
  const result = evaluateFit({
    policyVersion: "test-v1",
    hardGates: [{ id: "authorization", result: "FAIL", reason: "mandatory authorization missing", evidenceIds: [] }],
    dimensions: dimensions(),
  });
  assert.equal(result.hardGate, "FAIL");
  assert.equal("fitScore" in result, false);
});

test("dimension scores are clamped and weights are normalized", () => {
  const result = evaluateFit({
    policyVersion: "test-v1",
    hardGates: [],
    dimensions: dimensions({ role: { score: 200, weight: 25 }, skills: { score: -20, weight: 75 } }),
  });
  assert.equal(result.fitScore, 25);
  assert.equal(result.dimensions[0].score, 100);
  assert.equal(result.dimensions[1].score, 0);
});

test("confidence is independent from fit score", () => {
  const result = evaluateFit({
    policyVersion: "test-v1",
    hardGates: [],
    dimensions: dimensions({ role: { score: 100, evidenceConfidence: "LOW" }, skills: { score: 100, evidenceConfidence: "LOW" } }),
  });
  assert.equal(result.fitScore, 100);
  assert.equal(result.confidence, "LOW");
});

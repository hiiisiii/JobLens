import assert from "node:assert/strict";
import test from "node:test";
import { transitionApplication } from "../../dist/application/transition-service.js";

function application(overrides = {}) {
  return {
    applicationId: "app_1",
    opportunityId: "opp_1",
    jobId: "job_1",
    candidateProfileVersion: "cand_v1",
    state: "PREPARING",
    reviewerStatus: "PENDING",
    groundingBlockers: [],
    events: [],
    ...overrides,
  };
}

const ctx = {
  eventId: "evt_1",
  actor: "user",
  occurredAt: "2026-09-14T02:00:00+09:00",
};

test("PREPARING -> REVIEWING", () => {
  const result = transitionApplication(application(), { type: "START_REVIEW" }, ctx);
  assert.equal(result.nextState, "REVIEWING");
  assert.equal(result.application.events.length, 1);
});

test("READY requires reviewer pass and zero grounding blockers", () => {
  assert.throws(() =>
    transitionApplication(
      application({ state: "REVIEWING", reviewerStatus: "PENDING" }),
      { type: "MARK_READY" },
      ctx,
    ),
  );

  const passed = transitionApplication(
    application({ state: "REVIEWING", reviewerStatus: "PASS", groundingBlockers: [] }),
    { type: "MARK_READY" },
    ctx,
  );
  assert.equal(passed.nextState, "READY");
});

test("interview rounds stay in INTERVIEWING", () => {
  const first = transitionApplication(
    application({ state: "APPLIED" }),
    { type: "ADD_INTERVIEW_EVENT", occurredAt: ctx.occurredAt, round: "technical-1" },
    ctx,
  );
  assert.equal(first.nextState, "INTERVIEWING");
  const second = transitionApplication(
    first.application,
    { type: "ADD_INTERVIEW_EVENT", occurredAt: ctx.occurredAt, round: "culture-2" },
    { ...ctx, eventId: "evt_2" },
  );
  assert.equal(second.nextState, "INTERVIEWING");
  assert.equal(second.application.events.length, 2);
});

test("idempotency key prevents duplicate lifecycle events", () => {
  const keyed = { ...ctx, idempotencyKey: "idem_1" };
  const first = transitionApplication(application(), { type: "START_REVIEW" }, keyed);
  const second = transitionApplication(first.application, { type: "START_REVIEW" }, keyed);
  assert.equal(second.duplicate, true);
  assert.equal(second.application.events.length, 1);
});

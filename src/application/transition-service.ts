import type {
  Application,
  ApplicationOutcome,
  ApplicationState,
  LifecycleEvent,
} from "../core/domain/application.js";
import { DomainError } from "../core/errors/domain-error.js";

export type ApplicationCommand =
  | { type: "START_REVIEW" }
  | { type: "REQUEST_REVISION"; reason: string }
  | { type: "MARK_READY" }
  | { type: "MARK_APPLIED"; submittedAt: string; channel: string; userConfirmed: true }
  | { type: "ADD_INTERVIEW_EVENT"; occurredAt: string; round?: string }
  | { type: "MARK_OFFER_STAGE"; occurredAt: string }
  | { type: "COMPLETE"; outcome: ApplicationOutcome; occurredAt: string; reason?: string }
  | { type: "WITHDRAW"; occurredAt: string; reason?: string };

export interface TransitionContext {
  eventId: string;
  actor: "system" | "user" | "reviewer";
  occurredAt: string;
  idempotencyKey?: string;
}

export interface TransitionResult {
  application: Application;
  previousState: ApplicationState;
  nextState: ApplicationState;
  event: LifecycleEvent;
  duplicate: boolean;
}

function assertState(current: ApplicationState, allowed: ApplicationState[], command: string): void {
  if (!allowed.includes(current)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `Cannot execute ${command} from ${current}`,
    );
  }
}

export function transitionApplication(
  application: Application,
  command: ApplicationCommand,
  context: TransitionContext,
): TransitionResult {
  if (
    context.idempotencyKey &&
    application.events.some((event) => event.idempotencyKey === context.idempotencyKey)
  ) {
    const existing = application.events.find(
      (event) => event.idempotencyKey === context.idempotencyKey,
    );
    if (!existing) throw new DomainError("INVARIANT_BROKEN", "Existing event vanished");
    return {
      application,
      previousState: application.state,
      nextState: application.state,
      event: existing,
      duplicate: true,
    };
  }

  const previousState = application.state;
  let nextState: ApplicationState = previousState;
  let reason: string | undefined;
  let outcome = application.outcome;

  switch (command.type) {
    case "START_REVIEW":
      assertState(previousState, ["PREPARING"], command.type);
      nextState = "REVIEWING";
      break;
    case "REQUEST_REVISION":
      assertState(previousState, ["REVIEWING"], command.type);
      nextState = "REVISION_REQUIRED";
      reason = command.reason;
      break;
    case "MARK_READY":
      assertState(previousState, ["REVIEWING"], command.type);
      if (application.reviewerStatus !== "PASS" || application.groundingBlockers.length > 0) {
        throw new DomainError(
          "READY_GUARD_FAILED",
          "READY requires reviewer PASS and zero grounding blockers",
        );
      }
      nextState = "READY";
      break;
    case "MARK_APPLIED":
      assertState(previousState, ["READY"], command.type);
      if (command.userConfirmed !== true) {
        throw new DomainError("HUMAN_APPROVAL_REQUIRED", "APPLIED requires explicit user confirmation");
      }
      nextState = "APPLIED";
      break;
    case "ADD_INTERVIEW_EVENT":
      assertState(previousState, ["APPLIED", "INTERVIEWING"], command.type);
      nextState = "INTERVIEWING";
      reason = command.round;
      break;
    case "MARK_OFFER_STAGE":
      assertState(previousState, ["INTERVIEWING"], command.type);
      nextState = "OFFER_STAGE";
      break;
    case "COMPLETE":
      assertState(previousState, ["APPLIED", "INTERVIEWING", "OFFER_STAGE"], command.type);
      nextState = "COMPLETED";
      outcome = command.outcome;
      reason = command.reason;
      break;
    case "WITHDRAW":
      assertState(previousState, ["READY", "APPLIED", "INTERVIEWING", "OFFER_STAGE"], command.type);
      nextState = "WITHDRAWN";
      outcome = "WITHDRAWN";
      reason = command.reason;
      break;
  }

  const event: LifecycleEvent = {
    eventId: context.eventId,
    from: previousState,
    to: nextState,
    actor: context.actor,
    occurredAt: context.occurredAt,
    ...(reason ? { reason } : {}),
    ...(context.idempotencyKey ? { idempotencyKey: context.idempotencyKey } : {}),
  };

  const updated: Application = {
    ...application,
    state: nextState,
    events: [...application.events, event],
    ...(outcome ? { outcome } : {}),
  };

  return {
    application: updated,
    previousState,
    nextState,
    event,
    duplicate: false,
  };
}

import type { Application, ApplicationOutcome, SubmissionSnapshot } from "../core/domain/application.js";
import type { ApplicationPackage } from "../core/domain/application-package.js";
import { stableFingerprint } from "../discovery/fingerprint.js";
import type { EntityStore } from "../storage/store.js";
import { transitionApplication } from "./transition-service.js";

export type OutcomeEventInput =
  | { type: "APPLIED"; submittedAt: string; channel: string; userConfirmed: true; packageId?: string }
  | { type: "INTERVIEW"; occurredAt: string; round?: string; notes?: string }
  | { type: "OFFER_STAGE"; occurredAt: string }
  | { type: "COMPLETE"; outcome: ApplicationOutcome; occurredAt: string; reason?: string }
  | { type: "WITHDRAW"; occurredAt: string; reason?: string };

function ensureDate(value: string, label: string): void {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO-compatible datetime`);
}

function eventKey(applicationId: string, event: OutcomeEventInput): string {
  return `outcome:${stableFingerprint(JSON.stringify({ applicationId, event }))}`;
}

function latestPackage(packages: ApplicationPackage[], applicationId: string): ApplicationPackage | undefined {
  return packages
    .filter((item) => item.applicationId === applicationId)
    .sort((left, right) => right.preparedAt.localeCompare(left.preparedAt))[0];
}

function submissionSnapshot(applicationPackage: ApplicationPackage, submittedAt: string, channel: string): SubmissionSnapshot {
  const artifactVersions = Object.fromEntries(applicationPackage.artifacts.map((artifact) => [artifact.type, artifact.version]));
  const artifactHashes = Object.fromEntries(applicationPackage.artifacts.map((artifact) => [artifact.type, artifact.contentHash]));
  return {
    snapshotId: `submission:${stableFingerprint(JSON.stringify({ packageId: applicationPackage.packageId, submittedAt, channel, artifactVersions, artifactHashes }))}`,
    candidateProfileVersion: applicationPackage.candidateProfileVersion,
    artifactVersions,
    artifactHashes,
    submittedAt,
    channel: channel.trim(),
  };
}

export async function recordOutcome(input: {
  applicationId: string;
  event: OutcomeEventInput;
  applicationStore: EntityStore<Application>;
  packageStore: EntityStore<ApplicationPackage>;
  now: string;
}): Promise<Application> {
  const application = await input.applicationStore.get(input.applicationId);
  if (!application) throw new Error(`application not found: ${input.applicationId}`);
  const idempotencyKey = eventKey(application.applicationId, input.event);

  let updated: Application;
  switch (input.event.type) {
    case "APPLIED": { // external submission already happened; this only records it
      if (input.event.userConfirmed !== true) throw new Error("APPLIED requires explicit user confirmation");
      ensureDate(input.event.submittedAt, "submittedAt");
      if (!input.event.channel?.trim()) throw new Error("APPLIED requires a submission channel");
      const packages = await input.packageStore.list();
      const applicationPackage = input.event.packageId
        ? await input.packageStore.get(input.event.packageId)
        : latestPackage(packages, application.applicationId);
      if (!applicationPackage) throw new Error(`no application package found for ${application.applicationId}`);
      if (applicationPackage.applicationId !== application.applicationId) throw new Error("submission package does not belong to application");
      const transitioned = transitionApplication(application, {
        type: "MARK_APPLIED",
        submittedAt: input.event.submittedAt,
        channel: input.event.channel.trim(),
        userConfirmed: true,
      }, {
        eventId: `event:${stableFingerprint(`${idempotencyKey}:applied`)}`,
        actor: "user",
        occurredAt: input.now,
        idempotencyKey,
      });
      updated = transitioned.duplicate
        ? transitioned.application
        : { ...transitioned.application, submissionSnapshot: submissionSnapshot(applicationPackage, input.event.submittedAt, input.event.channel) };
      break;
    }
    case "INTERVIEW": {
      ensureDate(input.event.occurredAt, "occurredAt");
      updated = transitionApplication(application, {
        type: "ADD_INTERVIEW_EVENT",
        occurredAt: input.event.occurredAt,
        ...(input.event.round?.trim() ? { round: input.event.round.trim() } : {}),
      }, {
        eventId: `event:${stableFingerprint(`${idempotencyKey}:interview`)}`,
        actor: "user",
        occurredAt: input.event.occurredAt,
        idempotencyKey,
      }).application;
      break;
    }
    case "OFFER_STAGE": {
      ensureDate(input.event.occurredAt, "occurredAt");
      updated = transitionApplication(application, { type: "MARK_OFFER_STAGE", occurredAt: input.event.occurredAt }, {
        eventId: `event:${stableFingerprint(`${idempotencyKey}:offer`)}`,
        actor: "user",
        occurredAt: input.event.occurredAt,
        idempotencyKey,
      }).application;
      break;
    }
    case "COMPLETE": {
      ensureDate(input.event.occurredAt, "occurredAt");
      updated = transitionApplication(application, {
        type: "COMPLETE",
        outcome: input.event.outcome,
        occurredAt: input.event.occurredAt,
        ...(input.event.reason?.trim() ? { reason: input.event.reason.trim() } : {}),
      }, {
        eventId: `event:${stableFingerprint(`${idempotencyKey}:complete`)}`,
        actor: "user",
        occurredAt: input.event.occurredAt,
        idempotencyKey,
      }).application;
      break;
    }
    case "WITHDRAW": {
      ensureDate(input.event.occurredAt, "occurredAt");
      updated = transitionApplication(application, {
        type: "WITHDRAW",
        occurredAt: input.event.occurredAt,
        ...(input.event.reason?.trim() ? { reason: input.event.reason.trim() } : {}),
      }, {
        eventId: `event:${stableFingerprint(`${idempotencyKey}:withdraw`)}`,
        actor: "user",
        occurredAt: input.event.occurredAt,
        idempotencyKey,
      }).application;
      break;
    }
  }

  await input.applicationStore.put(updated.applicationId, updated);
  return updated;
}

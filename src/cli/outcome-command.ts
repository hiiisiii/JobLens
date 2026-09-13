import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RuntimeEnvironment } from "../config/runtime-config.js";
import { recordOutcome, type OutcomeEventInput } from "../application/outcome-service.js";
import { initializeWorkspace } from "../workspace/workspace.js";

interface OutcomeFileInput {
  event: OutcomeEventInput;
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

export async function outcomeCommand(args: string[], env: RuntimeEnvironment): Promise<string> {
  const applicationId = args[0];
  if (!applicationId || applicationId.startsWith("--")) throw new Error("outcome requires an application id as the first argument");
  const inputPath = optionValue(args, "--input");
  if (!inputPath || inputPath.startsWith("--")) throw new Error("outcome requires --input <outcome.json>");

  const parsed = JSON.parse(await readFile(resolve(inputPath), "utf8")) as OutcomeFileInput;
  if (!parsed?.event) throw new Error("outcome input requires an event object");
  const root = resolve(env.JOBLENS_WORKSPACE ?? ".joblens-workspace");
  const stores = await initializeWorkspace(root);
  const application = await recordOutcome({
    applicationId,
    event: parsed.event,
    applicationStore: stores.applications,
    packageStore: stores.packages,
    now: new Date().toISOString(),
  });

  const lines = [
    `application: ${application.applicationId} -> ${application.state}`,
    `events: ${application.events.length}`,
  ];
  if (application.submissionSnapshot) lines.push(`submission snapshot: ${application.submissionSnapshot.snapshotId}`);
  if (application.outcome) lines.push(`outcome: ${application.outcome}`);
  return lines.join("\n");
}

#!/usr/bin/env node
import { isHelpRequest, JOBLENS_CLI_USAGE, parseCommand } from "./index.js";
import { executeCommand } from "./runtime.js";
import { outcomeCommand } from "./outcome-command.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (isHelpRequest(argv)) {
    process.stdout.write(`${JOBLENS_CLI_USAGE}\n`);
    return;
  }

  const parsed = parseCommand(argv);
  const output = parsed.command === "outcome"
    ? await outcomeCommand(parsed.args, process.env)
    : await executeCommand(parsed.command, parsed.args);
  if (output) process.stdout.write(`${output}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`JobLens error: ${message}\n`);
  process.exitCode = 1;
});

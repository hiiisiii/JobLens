#!/usr/bin/env node
import { parseCommand } from "./index.js";
import { executeCommand } from "./runtime.js";

async function main(): Promise<void> {
  const parsed = parseCommand(process.argv.slice(2));
  const output = await executeCommand(parsed.command, parsed.args);
  if (output) process.stdout.write(`${output}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`JobLens error: ${message}\n`);
  process.exitCode = 1;
});

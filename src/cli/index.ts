export type JobLensCommand =
  | "setup"
  | "discover"
  | "rank"
  | "research"
  | "prepare"
  | "review"
  | "outcome";

export interface ParsedCommand {
  command: JobLensCommand;
  args: string[];
}

export function parseCommand(argv: string[]): ParsedCommand {
  const [rawCommand, ...args] = argv;
  const commands: JobLensCommand[] = [
    "setup",
    "discover",
    "rank",
    "research",
    "prepare",
    "review",
    "outcome",
  ];
  if (!rawCommand || !commands.includes(rawCommand as JobLensCommand)) {
    throw new Error(`Unknown JobLens command: ${rawCommand ?? "<none>"}`);
  }
  return { command: rawCommand as JobLensCommand, args };
}

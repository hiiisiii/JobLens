export type JobLensCommand =
  | "setup"
  | "discover"
  | "materialize"
  | "rank"
  | "research"
  | "prepare"
  | "review"
  | "outcome";

export interface ParsedCommand {
  command: JobLensCommand;
  args: string[];
}

export const JOBLENS_CLI_USAGE = `JobLens v0.1

Usage:
  joblens <command> [options]

Commands:
  setup        Initialize a private workspace or import a candidate profile
  discover     Ingest a manual posting or query a configured source
  materialize  Promote a verified discovery hit into a canonical JobPosting
  rank         Rank persisted jobs against the candidate profile
  research     Persist evidence-grounded company/job research
  prepare      Prepare grounded application artifacts after explicit approval
  review       Review an application package and run grounding checks
  outcome      Record user-confirmed submission and later lifecycle outcomes

Common flow:
  setup -> discover -> materialize -> rank -> research -> prepare -> review -> outcome

Examples:
  joblens setup --profile /private/path/candidate-profile.json
  joblens discover /private/path/posting.json
  joblens materialize hit:example --input /private/path/verified-posting.json
  joblens rank
  joblens research opp:example --input /private/path/research.json
  joblens prepare opp:example --input /private/path/application-draft.json --approve
  joblens review application:example --input /private/path/review.json
  joblens outcome application:example --input /private/path/outcome.json

Environment:
  JOBLENS_WORKSPACE   Private workspace directory (default: .joblens-workspace)
  SARAMIN_ACCESS_KEY Optional Saramin Open API access key

Use --help or -h to show this message.`;

export function isHelpRequest(argv: string[]): boolean {
  return argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help";
}

export function parseCommand(argv: string[]): ParsedCommand {
  const [rawCommand, ...args] = argv;
  const commands: JobLensCommand[] = [
    "setup",
    "discover",
    "materialize",
    "rank",
    "research",
    "prepare",
    "review",
    "outcome",
  ];
  if (!rawCommand || !commands.includes(rawCommand as JobLensCommand)) {
    throw new Error(`Unknown JobLens command: ${rawCommand ?? "<none>"}. Run joblens --help for usage.`);
  }
  return { command: rawCommand as JobLensCommand, args };
}

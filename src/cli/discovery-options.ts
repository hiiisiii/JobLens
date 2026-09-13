import type { SearchQuery } from "../sources/source-adapter.js";

export type DiscoverRequest =
  | { kind: "manual"; path: string }
  | { kind: "saramin"; query: SearchQuery };

function values(args: string[], name: string): string[] {
  const collected: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
    collected.push(...value.split(",").map((item) => item.trim()).filter(Boolean));
  }
  return collected;
}

function value(args: string[], name: string): string | undefined {
  return values(args, name)[0];
}

function pageSize(args: string[]): number | undefined {
  const raw = value(args, "--limit");
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 110) {
    throw new Error("--limit must be an integer between 1 and 110");
  }
  return parsed;
}

export function parseDiscoverRequest(args: string[]): DiscoverRequest {
  const first = args[0];
  if (first && !first.startsWith("--")) return { kind: "manual", path: first };

  const source = value(args, "--source");
  if (!source) throw new Error("discover requires a posting JSON path or --source <name>");
  if (source !== "saramin") throw new Error(`unsupported discover source: ${source}`);

  const keywords = values(args, "--keyword");
  if (keywords.length === 0) throw new Error("Saramin discovery requires at least one --keyword");
  const locations = values(args, "--location");
  const postedAfter = value(args, "--posted-after");
  if (postedAfter && Number.isNaN(Date.parse(postedAfter))) {
    throw new Error("--posted-after must be an ISO-compatible date or datetime");
  }
  const limit = pageSize(args);

  return {
    kind: "saramin",
    query: {
      keywords,
      ...(locations.length ? { locations } : {}),
      ...(postedAfter ? { postedAfter } : {}),
      ...(limit ? { pageSize: limit } : {}),
    },
  };
}

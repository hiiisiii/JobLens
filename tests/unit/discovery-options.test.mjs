import assert from "node:assert/strict";
import test from "node:test";
import { parseDiscoverRequest } from "../../dist/cli/discovery-options.js";

test("discover keeps backwards-compatible manual posting path", () => {
  assert.deepEqual(parseDiscoverRequest(["posting.json"]), { kind: "manual", path: "posting.json" });
});

test("discover parses Saramin keyword, location, freshness and limit options", () => {
  const request = parseDiscoverRequest([
    "--source", "saramin",
    "--keyword", "Node.js",
    "--keyword", "백엔드,TypeScript",
    "--location", "서울",
    "--posted-after", "2026-09-01",
    "--limit", "25",
  ]);
  assert.equal(request.kind, "saramin");
  assert.deepEqual(request.query, {
    keywords: ["Node.js", "백엔드", "TypeScript"],
    locations: ["서울"],
    postedAfter: "2026-09-01",
    pageSize: 25,
  });
});

test("Saramin discover requires keyword and validates limit", () => {
  assert.throws(() => parseDiscoverRequest(["--source", "saramin"]), /at least one --keyword/);
  assert.throws(() => parseDiscoverRequest(["--source", "saramin", "--keyword", "backend", "--limit", "111"]), /between 1 and 110/);
});

test("discover rejects unknown structured sources", () => {
  assert.throws(() => parseDiscoverRequest(["--source", "unknown", "--keyword", "backend"]), /unsupported discover source/);
});

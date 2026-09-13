import assert from "node:assert/strict";
import test from "node:test";
import { ManualSource } from "../../dist/sources/manual/manual-source.js";

const ctx = {
  requestId: "req_1",
  now: "2026-09-14T02:30:00+09:00",
  timeoutMs: 1000,
};

test("manual source ingests and normalizes an explicit posting", async () => {
  const source = new ManualSource();
  const ingested = await source.ingest({
    url: "https://company.example/jobs/backend",
    company: "Example",
    title: "Backend Engineer",
    fullText: "Build TypeScript APIs",
    locations: ["Seoul"],
    requiredSkills: ["TypeScript"],
    status: "open",
  }, ctx);

  assert.equal(ingested.ok, true);
  if (!ingested.ok) return;
  assert.match(ingested.data.rawHash, /^fnv1a32:/);

  const normalized = await source.normalize(ingested.data, ctx);
  assert.equal(normalized.ok, true);
  if (!normalized.ok) return;
  assert.equal(normalized.data.company.name, "Example");
  assert.equal(normalized.data.title, "Backend Engineer");
  assert.deepEqual(normalized.data.requiredSkills, ["TypeScript"]);
});

test("manual source rejects incomplete input", async () => {
  const source = new ManualSource();
  const result = await source.ingest({
    url: "",
    company: "Example",
    title: "Backend Engineer",
    fullText: "Build APIs",
  }, ctx);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "VALIDATION_FAILED");
});

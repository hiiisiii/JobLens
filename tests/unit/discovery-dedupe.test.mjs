import assert from "node:assert/strict";
import test from "node:test";
import { assessDuplicate } from "../../dist/discovery/dedupe.js";

function job(overrides = {}) {
  return {
    id: "job_a",
    sourceRefs: [{ sourceId: "source-a", externalId: "1", url: "https://example.com/jobs/1" }],
    companyName: "Example Corp",
    title: "Backend Engineer",
    locations: ["Seoul"],
    requiredSkills: [],
    preferredSkills: [],
    status: "open",
    fullText: "Backend role",
    fingerprint: "fp:a",
    discoveredAt: "2026-09-14T00:00:00Z",
    updatedAt: "2026-09-14T00:00:00Z",
    ...overrides,
  };
}

test("same source external id is an exact duplicate", () => {
  const result = assessDuplicate(job(), job({ id: "job_b", fingerprint: "fp:b" }));
  assert.equal(result.confidence, "EXACT");
  assert.equal(result.autoMerge, true);
});

test("tracking params do not prevent canonical URL match", () => {
  const left = job({ sourceRefs: [{ sourceId: "a", url: "https://example.com/jobs/42?utm_source=x" }] });
  const right = job({ id: "job_b", sourceRefs: [{ sourceId: "b", url: "https://example.com/jobs/42" }], fingerprint: "fp:b" });
  const result = assessDuplicate(left, right);
  assert.equal(result.confidence, "EXACT");
});

test("same fingerprint is likely and auto-mergeable", () => {
  const left = job({ sourceRefs: [{ sourceId: "a", url: "https://a.example/1" }] });
  const right = job({ id: "job_b", sourceRefs: [{ sourceId: "b", url: "https://b.example/2" }] });
  const result = assessDuplicate(left, right);
  assert.equal(result.confidence, "LIKELY");
  assert.equal(result.autoMerge, true);
});

test("same company and title is only a possible duplicate", () => {
  const left = job({ sourceRefs: [{ sourceId: "a", url: "https://a.example/1" }], fingerprint: "fp:a" });
  const right = job({ id: "job_b", sourceRefs: [{ sourceId: "b", url: "https://b.example/2" }], fingerprint: "fp:b" });
  const result = assessDuplicate(left, right);
  assert.equal(result.confidence, "POSSIBLE");
  assert.equal(result.autoMerge, false);
});

test("different company or title stays distinct", () => {
  const result = assessDuplicate(job(), job({ id: "job_b", companyName: "Other Corp", title: "Designer", fingerprint: "fp:b", sourceRefs: [{ sourceId: "b", url: "https://b.example/2" }] }));
  assert.equal(result.confidence, "DISTINCT");
});

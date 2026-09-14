import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getJobLensToolDefinition,
  getMcpInputSchema,
  parseCandidateProfile,
} from "../../dist/index.js";

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("workspace profile template matches the current CandidateProfile schema", async () => {
  const profile = await json("workspace-template/profile/candidate.example.json");
  const parsed = parseCandidateProfile(profile);
  assert.equal(parsed.profileId, "candidate-example");
  assert.ok(parsed.experienceEvidence?.length > 0);
});

test("verified-posting template satisfies the materialization tool contract", async () => {
  const verifiedPosting = await json("workspace-template/verified-posting.example.json");
  const schema = getMcpInputSchema(getJobLensToolDefinition("joblens_materialize_hit"));
  const result = schema.safeParse({ hitId: "hit:template-check", verifiedPosting });
  assert.equal(result.success, true, result.success ? undefined : JSON.stringify(result.error.issues));
});

test("research, application, review, and outcome examples match v0.1 public shapes", async () => {
  const research = await json("workspace-template/research-input.example.json");
  assert.ok(Array.isArray(research.evidence) && research.evidence.length > 0);
  assert.ok(Array.isArray(research.findings) && research.findings.length > 0);
  const evidenceKeys = new Set(research.evidence.map((item) => item.key));
  for (const finding of research.findings) {
    assert.ok(["verified_fact", "analysis", "community_signal", "opportunity", "risk"].includes(finding.kind));
    assert.ok(finding.evidenceKeys.length > 0);
    for (const key of finding.evidenceKeys) assert.ok(evidenceKeys.has(key));
  }

  const draft = await json("workspace-template/application-draft.example.json");
  assert.ok(Array.isArray(draft.artifacts) && draft.artifacts.length > 0);
  for (const artifact of draft.artifacts) {
    assert.ok(["resume", "self_intro", "cover_letter", "portfolio_brief"].includes(artifact.type));
    assert.equal(typeof artifact.content, "string");
    assert.ok(Array.isArray(artifact.claims));
    for (const claim of artifact.claims) {
      assert.ok(typeof claim.text === "string" && claim.text.length > 0);
      assert.ok(Array.isArray(claim.evidenceIds) && claim.evidenceIds.length > 0);
    }
  }

  const review = await json("workspace-template/review.example.json");
  assert.ok(["PASS", "FAIL"].includes(review.status));
  for (const finding of review.findings ?? []) {
    assert.ok(["BLOCKER", "WARNING"].includes(finding.severity));
    assert.ok(["grounding", "relevance", "clarity", "consistency", "other"].includes(finding.category));
    assert.ok(typeof finding.message === "string" && finding.message.length > 0);
  }

  const outcome = await json("workspace-template/outcome.example.json");
  assert.equal(outcome.event.type, "APPLIED");
  assert.equal(outcome.event.userConfirmed, true);
  assert.ok(!Number.isNaN(Date.parse(outcome.event.submittedAt)));
  assert.ok(typeof outcome.event.channel === "string" && outcome.event.channel.length > 0);
});

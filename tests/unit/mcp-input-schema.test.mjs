import assert from "node:assert/strict";
import test from "node:test";
import { getMcpInputSchema } from "../../dist/mcp/input-schema.js";
import { getJobLensToolDefinition } from "../../dist/tooling/tool-manifest.js";

function schema(name) {
  return getMcpInputSchema(getJobLensToolDefinition(name));
}

test("MCP read-only tools reject undeclared top-level input", () => {
  assert.throws(() => schema("joblens_profile_get").parse({ unexpected: true }));
  assert.deepEqual(schema("joblens_profile_get").parse({}), {});
});

test("MCP schemas enforce required ids and numeric bounds", () => {
  assert.throws(() => schema("joblens_discovery_hit_get").parse({}), /hitId/);
  assert.throws(() => schema("joblens_jobs_list").parse({ limit: 0 }));
  assert.throws(() => schema("joblens_jobs_list").parse({ limit: 501 }));
  assert.deepEqual(schema("joblens_jobs_list").parse({ limit: 20 }), { limit: 20 });
});

test("MCP explicit-decision tools reject inferred approval", () => {
  const prepare = schema("joblens_prepare");
  assert.throws(() => prepare.parse({ opportunityId: "opp:1", userApproved: false, draft: {} }));
  assert.throws(() => prepare.parse({ opportunityId: "opp:1", draft: {} }));
  assert.deepEqual(
    prepare.parse({ opportunityId: "opp:1", userApproved: true, draft: {} }),
    { opportunityId: "opp:1", userApproved: true, draft: {} },
  );
});

test("MCP materialization schema rejects missing verified content and extra top-level keys", () => {
  const materialize = schema("joblens_materialize_hit");
  assert.throws(() => materialize.parse({ hitId: "hit:1", verifiedPosting: { company: "Acme" } }));
  assert.throws(() => materialize.parse({
    hitId: "hit:1",
    verifiedPosting: {
      sourceUrl: "https://example.com/jobs/1",
      company: "Acme",
      title: "Backend Developer",
      fullText: "Build APIs",
      contentCompleteness: "full",
    },
    unexpected: true,
  }));
  const parsed = materialize.parse({
    hitId: "hit:1",
    verifiedPosting: {
      sourceUrl: "https://example.com/jobs/1",
      company: "Acme",
      title: "Backend Developer",
      fullText: "Build APIs",
      contentCompleteness: "full",
    },
  });
  assert.equal(parsed.hitId, "hit:1");
});

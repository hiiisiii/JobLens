import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

function candidateProfile() {
  return {
    profileId: "mcp-test-candidate",
    version: "v1",
    updatedAt: "2026-09-14T00:00:00Z",
    targetRoles: ["Backend Developer"],
    targetLevels: ["Entry"],
    skills: [{ name: "Node.js", evidenceIds: ["candidate:node"] }],
    locations: ["Seoul"],
    mustHaves: [],
    dealBreakers: [],
    documentRefs: [],
  };
}

function textJson(result) {
  const block = result.content.find((item) => item.type === "text");
  assert.ok(block && block.type === "text");
  return JSON.parse(block.text);
}

test("joblens-mcp completes stdio handshake, lists tools, and persists profile through canonical service", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "joblens-mcp-"));
  const client = new Client({ name: "joblens-test-client", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(process.cwd(), "dist", "mcp", "bin.js")],
    env: {
      JOBLENS_WORKSPACE: workspace,
      JOBLENS_WORKSPACE_ID: "mcp-test-workspace",
    },
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = new Set(tools.map((tool) => tool.name));
    assert.ok(names.has("joblens_profile_get"));
    assert.ok(names.has("joblens_prepare"));
    assert.ok(names.has("joblens_record_outcome"));

    const setup = await client.callTool({
      name: "joblens_setup",
      arguments: { profile: candidateProfile() },
    });
    assert.notEqual(setup.isError, true);
    const setupPayload = textJson(setup);
    assert.equal(setupPayload.data.profileId, "mcp-test-candidate");

    const profile = await client.callTool({ name: "joblens_profile_get", arguments: {} });
    assert.notEqual(profile.isError, true);
    const profilePayload = textJson(profile);
    assert.equal(profilePayload.data.profileId, "mcp-test-candidate");
    assert.equal(profilePayload.data.version, "v1");
  } finally {
    await client.close().catch(() => undefined);
    await rm(workspace, { recursive: true, force: true });
  }
});

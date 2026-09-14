import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const [command, workspace] = process.argv.slice(2);
if (!command || !workspace) {
  throw new Error("usage: node scripts/mcp-installed-smoke.mjs <joblens-mcp-bin> <workspace>");
}

const client = new Client({ name: "joblens-release-smoke", version: "1.0.0" });
const transport = new StdioClientTransport({
  command,
  env: {
    ...process.env,
    JOBLENS_WORKSPACE: workspace,
    JOBLENS_WORKSPACE_ID: "release-smoke",
  },
});

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = new Set(tools.map((tool) => tool.name));
  assert.ok(names.has("joblens_profile_get"));
  assert.ok(names.has("joblens_materialize_hit"));
  assert.ok(names.has("joblens_prepare"));
  assert.ok(names.has("joblens_record_outcome"));

  const result = await client.callTool({ name: "joblens_profile_get", arguments: {} });
  assert.notEqual(result.isError, true);
  const text = result.content.find((item) => item.type === "text");
  assert.ok(text && text.type === "text");
  const payload = JSON.parse(text.text);
  assert.equal(payload.data.profileId, "candidate-example");
} finally {
  await client.close().catch(() => undefined);
}

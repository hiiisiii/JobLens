#!/usr/bin/env node
import { resolve } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createJobLensMcpServer } from "./server.js";

async function main(): Promise<void> {
  const workspace = process.env.JOBLENS_WORKSPACE?.trim();
  if (!workspace) {
    throw new Error("JOBLENS_WORKSPACE is required for joblens-mcp and should point to a private workspace outside the public repository");
  }

  const server = createJobLensMcpServer({
    workspaceDir: resolve(workspace),
    workspaceId: process.env.JOBLENS_WORKSPACE_ID?.trim() || "local-workspace",
    env: process.env,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`JobLens MCP error: ${message}\n`);
  process.exitCode = 1;
});

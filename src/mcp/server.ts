import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/server";
import type { RuntimeEnvironment } from "../config/runtime-config.js";
import { JobLensToolService, type JobLensToolCall, type JobLensToolName } from "../tooling/joblens-tool-service.js";
import { JOBLENS_TOOL_DEFINITIONS } from "../tooling/tool-manifest.js";
import { getMcpInputSchema } from "./input-schema.js";

export interface JobLensMcpServerOptions {
  workspaceDir: string;
  workspaceId?: string;
  env?: RuntimeEnvironment;
  serverName?: string;
  serverVersion?: string;
}

function toToolCall(name: JobLensToolName, args: Record<string, unknown>): JobLensToolCall {
  return { tool: name, input: args } as unknown as JobLensToolCall;
}

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "null";
}

export function createJobLensMcpServer(options: JobLensMcpServerOptions): McpServer {
  if (!options.workspaceDir.trim()) throw new Error("MCP server requires a non-empty private workspace directory");
  const workspaceId = options.workspaceId?.trim() || "local-workspace";
  const service = new JobLensToolService(options.workspaceDir, options.env ?? process.env);
  const server = new McpServer({
    name: options.serverName ?? "joblens",
    version: options.serverVersion ?? "0.1.0-rc.1",
  });

  for (const definition of JOBLENS_TOOL_DEFINITIONS) {
    server.registerTool(
      definition.name,
      {
        description: `${definition.description} Approval class: ${definition.approvalClass}.`,
        inputSchema: getMcpInputSchema(definition),
      },
      async (args) => {
        const requestId = `mcp-${randomUUID()}`;
        const response = await service.invoke(toToolCall(definition.name, args), {
          requestId,
          workspaceId,
          client: "other",
          actor: "assistant",
        });

        if (!response.ok) {
          return {
            isError: true,
            content: [{
              type: "text" as const,
              text: serialize({ requestId: response.requestId, error: response.error, warnings: response.warnings }),
            }],
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: serialize({ requestId: response.requestId, data: response.data, warnings: response.warnings }),
          }],
        };
      },
    );
  }

  return server;
}

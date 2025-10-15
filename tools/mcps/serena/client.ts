// File: tools/mcps/serena/client.ts
// Purpose: Provide a reusable TypeScript wrapper around the Serena MCP server.
// Why: Allow Codex CLI workflows to launch the Serena agent via MCP without hand-written stdio plumbing.

import { StdioMcpClient, type StdioMcpClientOptions } from "../shared/stdioClient.ts";

export class SerenaClient extends StdioMcpClient {
  constructor(options: StdioMcpClientOptions = {}) {
    super(options, SerenaClient.defaultCommand, SerenaClient.defaultArgs);
  }

  public static defaultCommand(): string {
    const override = process.env.MCP_SERENA_COMMAND?.trim();
    if (override) return override;
    return "uvx";
  }

  public static defaultArgs(): string[] {
    const raw = process.env.MCP_SERENA_ARGS;
    if (!raw) {
      return ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"];
    }
    return raw
      .split(/\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }
}

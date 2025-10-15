// File: tools/mcps/context7/client.ts
// Purpose: Provide a reusable TypeScript wrapper around the context7 MCP server for Codex CLI workflows.
// Why: Simplify documentation lookups (`resolve-library-id`, `get-library-docs`) without manual shell commands.

import path from "node:path";
import { StdioMcpClient, type StdioMcpClientOptions } from "../shared/stdioClient.ts";

export class Context7Client extends StdioMcpClient {
  constructor(options: StdioMcpClientOptions = {}) {
    super(options, Context7Client.defaultCommand, Context7Client.defaultArgs);
  }

  public static defaultCommand(): string {
    const override = process.env.MCP_CONTEXT7_COMMAND?.trim();
    if (override) return override;

    const home = process.env.USERPROFILE ?? process.env.HOME;
    if (!home) {
      throw new Error(
        "Unable to resolve default context7 command because HOME/USERPROFILE is not set.",
      );
    }

    const executable = process.platform === "win32" ? "context7-mcp.cmd" : "context7-mcp";
    return path.join(home, ".codex", "mcp", "context7", "node_modules", ".bin", executable);
  }

  public static defaultArgs(): string[] {
    const raw = process.env.MCP_CONTEXT7_ARGS;
    if (!raw) return [];
    return raw
      .split(/\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }

  public async resolveLibraryId(libraryName: string): Promise<unknown> {
    if (!libraryName?.trim()) {
      throw new Error("libraryName must be a non-empty string.");
    }
    return this.callTool("resolve-library-id", { libraryName: libraryName.trim() });
  }

  public async getLibraryDocs(libraryId: string, tokens?: number): Promise<unknown> {
    if (!libraryId?.trim()) {
      throw new Error("libraryId must be a non-empty string.");
    }
    const args: Record<string, unknown> = {
      context7CompatibleLibraryID: libraryId.trim(),
    };
    if (typeof tokens === "number") {
      args.tokens = tokens;
    }
    return this.callTool("get-library-docs", args);
  }
}

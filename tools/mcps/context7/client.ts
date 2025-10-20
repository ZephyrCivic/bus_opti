// File: tools/mcps/context7/client.ts
// Purpose: Provide a reusable TypeScript wrapper around the context7 MCP server for Codex CLI workflows.
// Why: Simplify documentation lookups (`resolve-library-id`, `get-library-docs`) without manual shell commands.

import fs from "node:fs";
import path from "node:path";
import { StdioMcpClient, type StdioMcpClientOptions } from "../shared/stdioClient.ts";

export class Context7Client extends StdioMcpClient {
  private static cachedResolution?: { command: string; args: string[] };

  constructor(options: StdioMcpClientOptions = {}) {
    super(options, Context7Client.defaultCommand, Context7Client.defaultArgs);
  }

  private static parseArgs(raw?: string): string[] {
    if (!raw) return [];
    return raw
      .split(/\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }

  private static resolveCommandAndArgs(): { command: string; args: string[] } {
    if (Context7Client.cachedResolution) {
      return Context7Client.cachedResolution;
    }

    const override = process.env.MCP_CONTEXT7_COMMAND?.trim();
    if (override) {
      const args = Context7Client.parseArgs(process.env.MCP_CONTEXT7_ARGS);
      Context7Client.cachedResolution = { command: override, args };
      return Context7Client.cachedResolution;
    }

    const candidate = Context7Client.resolveDefaultExecutable();
    if (candidate) {
      Context7Client.cachedResolution = { command: candidate, args: [] };
      return Context7Client.cachedResolution;
    }

    const fallbackCommand = process.platform === "win32" ? "npx.cmd" : "npx";
    const fallbackArgs = ["-y", "@upstash/context7-mcp"];
    const extraArgs = Context7Client.parseArgs(process.env.MCP_CONTEXT7_ARGS);
    Context7Client.cachedResolution = { command: fallbackCommand, args: [...fallbackArgs, ...extraArgs] };
    return Context7Client.cachedResolution;
  }

  private static resolveDefaultExecutable(): string | undefined {
    const home = process.env.USERPROFILE ?? process.env.HOME;
    if (!home) {
      return undefined;
    }

    const executable = process.platform === "win32" ? "context7-mcp.cmd" : "context7-mcp";
    const candidate = path.join(home, ".codex", "mcp", "context7", "node_modules", ".bin", executable);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    return undefined;
  }

  public static defaultCommand(): string {
    return Context7Client.resolveCommandAndArgs().command;
  }

  public static defaultArgs(): string[] {
    return [...Context7Client.resolveCommandAndArgs().args];
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

// File: tools/mcps/playwright/client.ts
// Purpose: Provide a reusable TypeScript wrapper around the Playwright MCP server.

import path from "node:path";
import { StdioMcpClient, type StdioMcpClientOptions } from "../shared/stdioClient.ts";

export class PlaywrightClient extends StdioMcpClient {
  constructor(options: StdioMcpClientOptions = {}) {
    super(options, PlaywrightClient.defaultCommand, PlaywrightClient.defaultArgs);
  }

  public static defaultCommand(): string {
    const override = process.env.MCP_PLAYWRIGHT_COMMAND?.trim();
    if (override) return override;

    const home = process.env.USERPROFILE ?? process.env.HOME;
    if (!home) {
      throw new Error(
        "Unable to resolve default Playwright MCP command because HOME/USERPROFILE is not set.",
      );
    }

    const executable =
      process.platform === "win32" ? "mcp-server-playwright.cmd" : "mcp-server-playwright";
    return path.join(home, ".codex", "mcp", "playwright", "node_modules", ".bin", executable);
  }

  public static defaultArgs(): string[] {
    const raw = process.env.MCP_PLAYWRIGHT_ARGS;
    if (!raw) return [];
    return raw
      .split(/\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }
}

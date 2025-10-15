// File: tools/mcps/chrome-devtools/client.ts
// Purpose: Provide a reusable TypeScript wrapper around the Chrome DevTools MCP server.

import fs from "node:fs";
import path from "node:path";
import { StdioMcpClient, type StdioMcpClientOptions } from "../shared/stdioClient.ts";

function toPlatformPath(candidate: string): string {
  const windowsPattern = /^(?<drive>[A-Za-z]):[\\/](?<rest>.*)$/;
  const match = candidate.match(windowsPattern);
  if (!match) return candidate;

  const drive = match.groups?.drive?.toLowerCase();
  const rest = match.groups?.rest?.replace(/\\/g, "/");
  if (!drive || !rest) return candidate;

  // Keep absolute Windows paths untouched on native Windows.
  if (process.platform === "win32") {
    return `${drive.toUpperCase()}:\\${rest.replace(/\//g, "\\")}`;
  }

  // Translate Windows-style paths when running under WSL or other Unix environments.
  return path.posix.join("/mnt", drive, rest);
}

function splitArgs(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function resolveHomeDirectory(): string {
  const home = process.env.USERPROFILE ?? process.env.HOME;
  if (!home) {
    throw new Error(
      "Unable to resolve home directory for Chrome DevTools MCP. Set MCP_CHROME_DEVTOOLS_ARGS or MCP_CHROME_DEVTOOLS_ENTRY explicitly.",
    );
  }
  return home;
}

function buildDefaultEntry(): string {
  const entryOverride = process.env.MCP_CHROME_DEVTOOLS_ENTRY?.trim();
  if (entryOverride) {
    return path.resolve(toPlatformPath(entryOverride));
  }

  const home = resolveHomeDirectory();
  return path.resolve(path.join(home, ".codex", "mcp", "chrome-dev", "build", "src", "index.js"));
}

export class ChromeDevtoolsClient extends StdioMcpClient {
  constructor(options: StdioMcpClientOptions = {}) {
    super(options, ChromeDevtoolsClient.defaultCommand, ChromeDevtoolsClient.defaultArgs);
  }

  public static defaultCommand(): string {
    const override = process.env.MCP_CHROME_DEVTOOLS_COMMAND?.trim();
    if (override) return override;
    return "node";
  }

  public static defaultArgs(): string[] {
    const raw = process.env.MCP_CHROME_DEVTOOLS_ARGS;
    if (raw) {
      return splitArgs(raw);
    }

    const candidate = buildDefaultEntry();
    if (!fs.existsSync(candidate)) {
      throw new Error(
        `Chrome DevTools MCP server entry not found at ${candidate}. Set MCP_CHROME_DEVTOOLS_ENTRY or MCP_CHROME_DEVTOOLS_ARGS to point at the built server entry (e.g. /path/to/chrome-dev/build/src/index.js).`,
      );
    }

    return [candidate];
  }
}

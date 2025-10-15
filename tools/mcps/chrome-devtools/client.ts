// File: tools/mcps/chrome-devtools/client.ts
// Purpose: Provide a TypeScript wrapper around the Chrome DevTools MCP server.

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

  // Windowsの場合はそのまま返す。
  if (process.platform === "win32") {
    return `${drive.toUpperCase()}:\\${rest.replace(/\//g, "\\")}`;
  }

  // WSL / UNIX 系の場合は /mnt/<drive>/rest に変換
  return path.posix.join("/mnt", drive, rest);
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
      return raw
        .split(/\s+/)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
    }

    const entry = "C:/Users/chaka/.codex/mcp/chrome-dev/build/src/index.js";
    const platformPath = toPlatformPath(entry);
    const normalized = path.resolve(platformPath);

    if (!fs.existsSync(normalized)) {
      // ファイルが無い場合でも、呼び出し側で環境変数を上書きできるよう明示的に例外を投げる。
      throw new Error(
        "Chrome DevTools MCP server entry not found. Please set MCP_CHROME_DEVTOOLS_ARGS to point at your chrome-dev server entry (e.g. `/path/to/chrome-dev/build/src/index.js`).",
      );
    }

    return [normalized];
  }
}

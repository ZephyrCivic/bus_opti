// File: tools/mcps/context7/resolveCli.ts
// Where: tools/mcps/context7/
// What: Minimal CLI to resolve a Context7 library ID via Context7Client
// Why: 手動ホットフィックス時でも Context7 からライブラリ ID を取得できるようにするため。

import { resolveContext7 } from "../../context7Cli.ts";
import { Context7Client } from "./client.ts";

type McpContentItem = { type?: unknown; text?: unknown };

function extractTextFromMcpResult(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return undefined;

  const textParts = content
    .map((item) => {
      if (typeof item === "object" && item !== null) {
        const candidate = item as McpContentItem;
        if (candidate.type === "text" && typeof candidate.text === "string") {
          return candidate.text;
        }
      }
      return undefined;
    })
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (textParts.length === 0) {
    return undefined;
  }
  return textParts.join("\n\n");
}

function isMcpErrorMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized.startsWith("error") || normalized.includes("mcp error");
}

function formatSearchResults(results: Awaited<ReturnType<typeof resolveContext7>>): string {
  if (results.length === 0) {
    return "No matching libraries were found.";
  }
  return results
    .map((entry) => {
      const lines = [`- ${entry.title} (${entry.libraryId})`];
      if (entry.description) {
        lines.push(`  ${entry.description}`);
      }
      if (entry.docsSiteUrl) {
        lines.push(`  docs: ${entry.docsSiteUrl}`);
      }
      if (entry.lastUpdate) {
        lines.push(`  lastUpdate: ${entry.lastUpdate}`);
      }
      if (typeof entry.totalTokens === "number") {
        lines.push(`  tokens: ${entry.totalTokens}`);
      }
      return lines.join("\n");
    })
    .join("\n");
}

async function main() {
  const [, , libraryArg] = process.argv;
  if (!libraryArg) {
    console.error(
      [
        "Usage:",
        "  npx tsx tools/mcps/context7/resolveCli.ts <libraryName>",
        "  npm run context7:resolve -- <libraryName>",
      ].join("\n"),
    );
    process.exit(2);
  }

  const client = new Context7Client();
  let fallbackReason: string | undefined;

  try {
    await client.connect();
    const result = await client.resolveLibraryId(libraryArg);
    const mcpText = extractTextFromMcpResult(result);
    if (mcpText && !isMcpErrorMessage(mcpText)) {
      console.log(mcpText);
      return;
    }
    fallbackReason = mcpText ?? "MCP response did not contain readable text.";
  } catch (error) {
    fallbackReason = error instanceof Error ? error.message : String(error);
  } finally {
    await client.disconnect().catch(() => void 0);
  }

  try {
    if (fallbackReason) {
      console.error(
        `[context7:resolve] MCP search failed (${fallbackReason}). Falling back to direct HTTP API.`,
      );
    }
    const results = await resolveContext7(libraryArg);
    console.log(formatSearchResults(results));
  } catch (fallbackError) {
    console.error(fallbackError instanceof Error ? fallbackError.message : fallbackError);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

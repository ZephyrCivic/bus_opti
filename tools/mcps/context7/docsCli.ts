// File: tools/mcps/context7/docsCli.ts
// Where: tools/mcps/context7/
// What: Minimal CLI to fetch docs via Context7Client (get-library-docs)
// Why: CLI 経由で素早くドキュメントを取得できるようにするため。

import { DEFAULT_TOKENS, fetchContext7Docs } from "../../context7Cli.ts";
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
  return (
    normalized.startsWith("error fetching library documentation") ||
    normalized.includes("mcp error")
  );
}

async function main() {
  const [, , libraryArg, tokensArg] = process.argv;
  if (!libraryArg) {
    console.error(
      [
        "Usage:",
        "  npx tsx tools/mcps/context7/docsCli.ts <libraryId> [tokens]",
        "  npm run context7:docs -- <libraryId> [tokens]",
      ].join("\n"),
    );
    process.exit(2);
  }
  const tokens = tokensArg ? Number(tokensArg) : undefined;
  if (tokensArg && (Number.isNaN(tokens) || tokens! <= 0)) {
    console.error("tokens must be a positive number");
    process.exit(2);
  }

  const client = new Context7Client();
  let fallbackReason: string | undefined;

  try {
    await client.connect();
    const result = await client.getLibraryDocs(libraryArg, tokens);
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
        `[context7:docs] MCP fetch failed (${fallbackReason}). Falling back to direct HTTP API.`,
      );
    }
    const fallbackTokens = tokens ?? DEFAULT_TOKENS;
    const directDocs = await fetchContext7Docs(libraryArg, fallbackTokens);
    console.log(directDocs);
  } catch (fallbackError) {
    console.error(fallbackError instanceof Error ? fallbackError.message : fallbackError);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

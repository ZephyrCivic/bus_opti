// File: tools/mcps/context7/docsCli.ts
// Where: tools/mcps/context7/
// What: Minimal CLI to fetch docs via Context7Client (get-library-docs)
// Why: 手動シェルより安全に、ヘルパー経由で実行するため

import { Context7Client } from "./client.ts";

async function main() {
  const [, , libraryArg, tokensArg] = process.argv;
  if (!libraryArg) {
    console.error('Usage: ts-node tools/mcps/context7/docsCli.ts <libraryId> [tokens]');
    process.exit(2);
  }
  const tokens = tokensArg ? Number(tokensArg) : undefined;
  if (tokensArg && (Number.isNaN(tokens) || tokens! <= 0)) {
    console.error('tokens must be a positive number');
    process.exit(2);
  }

  const client = new Context7Client();
  try {
    await client.connect();
    const result = await client.getLibraryDocs(libraryArg, tokens);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.disconnect().catch(() => void 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

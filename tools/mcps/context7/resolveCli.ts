// File: tools/mcps/context7/resolveCli.ts
// Where: tools/mcps/context7/
// What: Minimal CLI to resolve a Context7 library ID via Context7Client
// Why: TODO前提の公式ドキュメント取得フローをヘルパー経由で安全に実行するため

import { Context7Client } from "./client.ts";

async function main() {
  const [, , libraryArg] = process.argv;
  if (!libraryArg) {
    console.error("Usage: ts-node tools/mcps/context7/resolveCli.ts <libraryName>");
    process.exit(2);
  }

  const client = new Context7Client();
  try {
    await client.connect();
    const result = await client.resolveLibraryId(libraryArg);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.disconnect().catch(() => void 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

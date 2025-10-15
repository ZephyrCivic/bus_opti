#!/usr/bin/env node
// File: tools/encoding/cli.cjs
// Where: tools/encoding/
// What: 統合エンコーディングツール（検査・走査・BOM除去・内容確認）CLI
// Why: 既存の encoding スクリプトを一元化し、開発者が少ないコマンドで文字化け対策を実施できるようにする

const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const ROOT = path.resolve(__dirname, "..", "..");
const TEXT_EXT = new Set([
  ".md",
  ".mdx",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".mjs",
  ".cjs",
  ".mts",
  ".css",
  ".html",
  ".txt",
  ".yaml",
  ".yml",
]);
const SKIP_DIRS = new Set([".git", ".wrangler", "node_modules", "dist", "build", "tmp"]);
const SKIP_FILES = new Set([path.resolve(__dirname, "cli.cjs")]);
const SUSPICIOUS_PATTERN = /[縺繧縲螳荳蛟邏驥鬮蟄蜿遉髢阡邨蛯鬟蠢諱讐]/u;

function printUsage() {
  console.error(
    [
      "usage: node tools/encoding/cli.cjs <command> [options]",
      "",
      "Commands:",
      "  check [--json]             UTF-8 / U+FFFD / 典型的な文字化けを検査",
      "  scan                       U+FFFD を含むファイル一覧を JSON で出力",
      "  strip-bom --all            リポジトリ全体の UTF-8 BOM を除去",
      "  strip-bom <file>           指定ファイルの BOM を除去",
      "  print <file>               対象ファイルを JSON 文字列として出力（表示崩れ対策）",
      "",
      "Examples:",
      "  node tools/encoding/cli.cjs check",
      "  node tools/encoding/cli.cjs strip-bom --all",
      "  node tools/encoding/cli.cjs print docs/runbooks/encoding.md",
    ].join("\n"),
  );
}

function listTextFiles(root = ROOT) {
  const stack = [root];
  const files = [];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (TEXT_EXT.has(path.extname(entry.name).toLowerCase()) && !SKIP_FILES.has(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function stripBomFromBuffer(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3);
  }
  return buffer;
}

function commandCheck(options) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const replacementFiles = [];
  const invalidUtf8Files = [];
  const suspiciousFiles = [];
  const bomFiles = [];

  for (const file of listTextFiles()) {
    const buffer = fs.readFileSync(file);
    const hasBom = stripBomFromBuffer(buffer) !== buffer;
    const stripped = hasBom ? stripBomFromBuffer(buffer) : buffer;

    try {
      decoder.decode(stripped);
    } catch {
      invalidUtf8Files.push(path.relative(ROOT, file));
      continue;
    }

    const text = stripped.toString("utf8");
    if (text.includes("\uFFFD")) {
      replacementFiles.push(path.relative(ROOT, file));
    }
    if (SUSPICIOUS_PATTERN.test(text)) {
      suspiciousFiles.push(path.relative(ROOT, file));
    }
    if (hasBom) {
      bomFiles.push(path.relative(ROOT, file));
    }
  }

  const hasIssues =
    replacementFiles.length > 0 || invalidUtf8Files.length > 0 || suspiciousFiles.length > 0 || bomFiles.length > 0;

  if (options.json) {
    const payload = {
      replacementFiles,
      invalidUtf8Files,
      suspiciousFiles,
      bomFiles,
    };
    process.stdout.write(JSON.stringify(payload, null, 2));
  } else if (hasIssues) {
    if (invalidUtf8Files.length > 0) {
      console.error("以下のファイルは UTF-8 としてデコードできませんでした:");
      for (const file of invalidUtf8Files) console.error(`  - ${file}`);
    }
    if (replacementFiles.length > 0) {
      console.error("以下のファイルに U+FFFD (Replacement Character) が含まれています:");
      for (const file of replacementFiles) console.error(`  - ${file}`);
    }
    if (suspiciousFiles.length > 0) {
      console.error("以下のファイルに Shift_JIS 由来の文字化けと思われる文字が含まれています:");
      for (const file of suspiciousFiles) console.error(`  - ${file}`);
    }
    if (bomFiles.length > 0) {
      console.error("以下のファイルに UTF-8 BOM が含まれています:");
      for (const file of bomFiles) console.error(`  - ${file}`);
    }
  } else {
    console.log("UTF-8 / 文字化けチェックを完了しました。問題は検出されていません。");
  }

  return hasIssues ? 1 : 0;
}

function commandScan() {
  const results = [];
  for (const file of listTextFiles()) {
    const text = fs.readFileSync(file, "utf8");
    let count = 0;
    for (const char of text) {
      if (char === "\uFFFD") count += 1;
    }
    if (count > 0) {
      results.push({ file: path.relative(ROOT, file), count });
    }
  }
  results.sort((a, b) => b.count - a.count);
  const payload = { total: results.length, files: results };
  process.stdout.write(JSON.stringify(payload, null, 2));
  return results.length > 0 ? 1 : 0;
}

function stripBomFile(targetPath) {
  const abs = path.resolve(process.cwd(), targetPath);
  const buffer = fs.readFileSync(abs);
  const stripped = stripBomFromBuffer(buffer);
  const changed = stripped !== buffer;
  if (changed) {
    fs.writeFileSync(abs, Buffer.from(stripped));
  }
  return { file: path.relative(process.cwd(), abs), stripped: changed };
}

function commandStripBom(args) {
  if (args.includes("--all")) {
    const changes = [];
    for (const file of listTextFiles()) {
      const relative = path.relative(ROOT, file);
      const result = stripBomFile(relative);
      if (result.stripped) {
        changes.push(result.file);
        console.log(`[strip-bom] ${result.file}`);
      }
    }
    console.log(`[strip-bom] done: stripped=${changes.length}`);
    return 0;
  }

  const target = args[0];
  if (!target) {
    console.error("strip-bom: ファイルパス、または --all のいずれかを指定してください。");
    return 2;
  }
  const result = stripBomFile(target);
  process.stdout.write(JSON.stringify(result));
  return 0;
}

function commandPrint(args) {
  const target = args[0];
  if (!target) {
    console.error("print: 対象ファイルを指定してください。");
    return 2;
  }
  const abs = path.resolve(process.cwd(), target);
  const text = fs.readFileSync(abs, "utf8");
  process.stdout.write(JSON.stringify(text));
  return 0;
}

function parseCheckOptions(args) {
  const options = { json: false };
  for (const arg of args) {
    if (arg === "--json") {
      options.json = true;
    } else {
      console.error(`check: 未知のオプションです: ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

function main() {
  const [, , command, ...rest] = process.argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    process.exit(command ? 0 : 1);
    return;
  }

  switch (command) {
    case "check": {
      const code = commandCheck(parseCheckOptions(rest));
      process.exit(code);
      return;
    }
    case "scan": {
      const code = commandScan();
      process.exit(code);
      return;
    }
    case "strip-bom": {
      const code = commandStripBom(rest);
      process.exit(code);
      return;
    }
    case "print": {
      const code = commandPrint(rest);
      process.exit(code);
      return;
    }
    default: {
      console.error(`未知のコマンドです: ${command}`);
      printUsage();
      process.exit(1);
    }
  }
}

main();

'use strict';

/**
 * Archive completed TODOs (checkbox items marked [x]/[X]) from plans.md
 * - Groups archived items under their nearest headings (##/###/####)
 * - Writes to plans.archive/<YYYY-MM-DD>.md (appends if exists)
 * - Removes archived blocks from plans.md, preserving other content
 */

const fs = require('fs');
const path = require('path');

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isHeading(line) {
  return /^\s*#{1,6}\s+/.test(line);
}

function headingLevel(line) {
  const m = line.match(/^(\s*#{1,6})\s+/);
  return m ? m[1].trim().length : 0;
}

function headingText(line) {
  return line.replace(/^\s*#{1,6}\s+/, '').trim();
}

function isListBullet(line) {
  return /^\s*(?:[-*+]|\d+\.)\s+/.test(line);
}

function isCompletedCheckbox(line) {
  return /^\s*(?:[-*+]|\d+\.)\s*\[[xX]\]\s+/.test(line);
}

function indentOf(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

function main() {
  const root = process.cwd();
  const plansPath = path.join(root, 'plans.md');
  if (!fs.existsSync(plansPath)) {
    console.error('plans.md not found');
    process.exit(1);
  }

  const archiveDir = path.join(root, 'plans.archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  const dateStr = todayStr();
  const archivePath = path.join(archiveDir, `${dateStr}.md`);

  const raw = fs.readFileSync(plansPath, 'utf8');
  const lines = raw.split(/\r?\n/);

  let h2 = '';
  let h3 = '';
  let h4 = '';
  const groups = new Map(); // key -> { h2, h3, h4, blocks: string[][] }
  const toRemove = new Array(lines.length).fill(false);

  function keyOf() {
    return [h2, h3, h4].filter(Boolean).join(' :: ');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isHeading(line)) {
      const lvl = headingLevel(line);
      const txt = headingText(line);
      if (lvl === 2) { h2 = txt; h3 = ''; h4 = ''; }
      else if (lvl === 3) { h3 = txt; h4 = ''; }
      else if (lvl === 4) { h4 = txt; }
      else { /* ignore deeper */ }
      continue;
    }

    if (!isCompletedCheckbox(line)) continue;

    const start = i;
    const baseIndent = indentOf(line);
    let j = i + 1;
    const block = [line];
    // Capture subsequent lines that belong to this item
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (isHeading(l)) break; // next section
      if (isListBullet(l) && indentOf(l) <= baseIndent) break; // next sibling item
      // otherwise, treat as part of this item's description/sublist/code
      block.push(l);
    }

    // Mark removal
    for (let k = start; k < j; k++) toRemove[k] = true;

    // Group under current headings
    const k = keyOf();
    if (!groups.has(k)) groups.set(k, { h2, h3, h4, blocks: [] });
    groups.get(k).blocks.push(block);

    // Continue from j - 1 (for loop will i++)
    i = j - 1;
  }

  // If nothing to archive, exit gracefully
  const totalArchived = Array.from(groups.values()).reduce((acc, g) => acc + g.blocks.length, 0);
  if (totalArchived === 0) {
    console.log('No completed TODOs found. Nothing to archive.');
    return;
  }

  // Build archive content
  const archiveParts = [];
  const now = new Date().toISOString();
  if (!fs.existsSync(archivePath)) {
    archiveParts.push(`# Completed TODO Archive\n`);
    archiveParts.push(`Date: ${dateStr}`);
    archiveParts.push('');
  } else {
    archiveParts.push('');
    archiveParts.push('---');
    archiveParts.push(`Appended: ${now}`);
    archiveParts.push('');
  }

  for (const [key, g] of groups.entries()) {
    if (g.h2) { archiveParts.push(`## ${g.h2}`); }
    if (g.h3) { archiveParts.push(`### ${g.h3}`); }
    if (g.h4) { archiveParts.push(`#### ${g.h4}`); }
    for (const block of g.blocks) {
      archiveParts.push(block.join('\n'));
      archiveParts.push('');
    }
  }

  fs.writeFileSync(archivePath, (fs.existsSync(archivePath) ? fs.readFileSync(archivePath, 'utf8') + '\n' : '') + archiveParts.join('\n'), 'utf8');

  // Build new plans.md without archived blocks
  const newLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (!toRemove[i]) newLines.push(lines[i]);
  }

  // Tidy: collapse >2 consecutive blank lines into 1
  const tidied = [];
  let blankRun = 0;
  for (const ln of newLines) {
    if (ln.trim() === '') {
      blankRun++;
      if (blankRun <= 1) tidied.push(ln);
    } else {
      blankRun = 0;
      tidied.push(ln);
    }
  }

  fs.writeFileSync(plansPath, tidied.join('\n'), 'utf8');

  console.log(`Archived ${totalArchived} completed TODO(s) to ${path.relative(root, archivePath)}`);
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error(e); process.exit(1); }
}


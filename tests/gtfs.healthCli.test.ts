/**
 * tests/gtfs.healthCli.test.ts
 * 目的: GTFS 健全性CLIの最小検査（block_id 非空率=0%）を確認する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

import { gtfsHealth } from '../tools/gtfsHealthCli';

const zipPath = resolve(process.cwd(), 'data/GTFS-JP(gunmachuo).zip');

test('gtfsHealth reports blockless for gunmachuo GTFS', async () => {
  const s = await gtfsHealth(zipPath);
  assert.equal(s.hasTrips, true);
  assert.equal(s.hasBlockIdColumn, true);
  assert.equal(s.blockIdNonEmptyCount, 0);
  assert.equal(s.blockless, true);
  assert.ok((s.tripsHeader ?? []).includes('block_id'));
});


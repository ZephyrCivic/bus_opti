/**
 * tests/docs.templates.test.ts
 * 目的: テンプレートCSVの存在とヘッダー整合を軽量検証。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function headerOf(relPath: string): string {
  const text = readFileSync(resolve(process.cwd(), relPath), 'utf8');
  return (text.split(/\r?\n/)[0] ?? '').trim();
}

test('depots template header matches importer contract', () => {
  assert.equal(
    headerOf('docs/templates/depots.template.csv'),
    'depot_id,name,lat,lon,open_time,close_time,min_turnaround_min',
  );
});

test('relief_points template header matches importer contract', () => {
  assert.equal(
    headerOf('docs/templates/relief_points.template.csv'),
    'relief_id,name,lat,lon,stop_id,walk_time_to_stop_min,allowed_window',
  );
});

test('deadhead_rules template header matches importer contract', () => {
  assert.equal(
    headerOf('docs/templates/deadhead_rules.template.csv'),
    'from_id,to_id,mode,travel_time_min,distance_km,allowed_window',
  );
});

test('drivers template header matches importer contract', () => {
  assert.equal(headerOf('docs/templates/drivers.template.csv'), 'driver_id,name');
});


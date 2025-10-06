/**
 * tests/duty.specs.test.ts
 * Duty編集仕様ドラフトが存在し、主要キーワード/スキーマ断片が含まれることを軽く検証。
 * 目的: ドキュメントの存在保証と、今後のリグレッション検知（用語の合意点）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const specPath = resolve(process.cwd(), 'docs/specs/duty-editing.md');
const addendumPath = resolve(process.cwd(), 'docs/specs/duty-editing.addendum.md');
const text = readFileSync(specPath, 'utf8');
const addendum = readFileSync(addendumPath, 'utf8');

test('Duty編集仕様ドキュメントが存在する', () => {
  assert.ok(text.length > 0);
});

test('主要操作: 追加/移動/削除 と Undo(1) を明記', () => {
  assert.match(text, /追加/);
  assert.match(text, /移動/);
  assert.match(text, /削除/);
  assert.match(text, /Undo\(1\)/);
});

test('スキーマ断片: duty_id と segment_start_trip_id', () => {
  assert.match(text, /duty_id/);
  assert.match(text, /segment_start_trip_id/);
});

test('用語の整合: mid-duty break と relief-point constraint 併記', () => {
  assert.match(text, /mid-duty break/);
  assert.match(text, /relief-point constraint/);
});

test('追補: 手動指定・drivers.csv・Redo・スタック上限を明記', () => {
  assert.match(addendum, /手動指定/);
  assert.match(addendum, /drivers\.csv/);
  assert.match(addendum, /Redo/);
  assert.match(addendum, /スタック上限/);
});

test('追補: 同一Block内で複数Dutyを許容', () => {
  assert.match(addendum, /複数Dutyを許容/);
});

test('追補: Dutiesインポートはデフォルト「置換」', () => {
  assert.match(addendum, /インポート[^\n]+デフォルトは「置換」/);
});

test('追補: マスタ未登録は弱い警告だが保存可能', () => {
  assert.match(addendum, /弱い警告/);
  assert.match(addendum, /保存・エクスポートは可能/);
});

test('追補: Block内Duty数>2で注意喚起（閾値既定2）', () => {
  assert.match(addendum, />2/);
  assert.match(addendum, /既定=2/);
});

# Explorer bundle adjustments (2025-10-15)

- MapLibre GL を `import()` で遅延読み込みし、Explorer の初期バンドルサイズを安全に減らした。投入箇所は `src/features/explorer/loadMapLibre.ts` と `src/features/explorer/MapView.tsx`。
- 遅延インポートをキャッシュするユーティリティに対し、`tests/explorer/loadMapLibre.test.ts` を追加して 1 回のロードで済むことを保証した。

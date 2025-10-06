/**
 * src/features/explorer/ExplorerView.tsx
 * Wraps MapView and will later host Stops/Shapes overlays and service-day filter.
 */
import MapView from './MapView';

export default function ExplorerView(): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Explorer</h2>
        <p className="text-sm text-muted-foreground">地図表示（キー不要スタイル）。今後 Stops/Shapes とフィルタを追加。</p>
      </div>
      <MapView />
    </div>
  );
}

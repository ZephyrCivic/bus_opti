/**
 * src/features/explorer/MapView.tsx
 * Renders MapLibre GL map and overlays imported Stops/Shapes with auto-fit behavior.
 */
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import maplibregl, { Map, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useGtfsImport } from '../../services/import/GtfsImportProvider';
import { buildExplorerGeoJson, type BoundingBox, type ExplorerGeoJson } from './mapData';

const STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const STOPS_SOURCE_ID = 'explorer-stops';
const SHAPES_SOURCE_ID = 'explorer-shapes';
const STOPS_LAYER_ID = 'explorer-stops-layer';
const SHAPES_LAYER_ID = 'explorer-shapes-layer';
const MAP_FIT_PADDING = 48;
const DEFAULT_CENTER: [number, number] = [139.7671, 35.6812]; // Tokyo Station
const DEFAULT_ZOOM = 9;

export default function MapView(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const mapLoadedRef = useRef(false);
  const latestBoundsRef = useRef<BoundingBox | null>(null);

  const { result } = useGtfsImport();
  const explorerData = useMemo(() => buildExplorerGeoJson(result), [result]);
  const latestDataRef = useRef(explorerData);

  useEffect(() => {
    latestDataRef.current = explorerData;
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) {
      return;
    }
    applyExplorerData(map, explorerData, latestBoundsRef);
  }, [explorerData]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: true,
    });
    mapRef.current = map;

    const handleLoad = () => {
      mapLoadedRef.current = true;
      initializeSources(map);
      applyExplorerData(map, latestDataRef.current, latestBoundsRef);
    };

    map.on('load', handleLoad);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    return () => {
      map.off('load', handleLoad);
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      latestBoundsRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-[480px] w-full rounded-md border" />;
}

function initializeSources(map: Map): void {
  const empty = buildExplorerGeoJson();

  if (!map.getSource(STOPS_SOURCE_ID)) {
    map.addSource(STOPS_SOURCE_ID, {
      type: 'geojson',
      data: empty.stops,
    });
    map.addLayer({
      id: STOPS_LAYER_ID,
      type: 'circle',
      source: STOPS_SOURCE_ID,
      paint: {
        'circle-radius': 4,
        'circle-color': '#2563eb',
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  if (!map.getSource(SHAPES_SOURCE_ID)) {
    map.addSource(SHAPES_SOURCE_ID, {
      type: 'geojson',
      data: empty.shapes,
    });
    map.addLayer({
      id: SHAPES_LAYER_ID,
      type: 'line',
      source: SHAPES_SOURCE_ID,
      paint: {
        'line-color': '#0f172a',
        'line-width': 2,
        'line-opacity': 0.8,
      },
    });
  }
}

function applyExplorerData(
  map: Map,
  data: ExplorerGeoJson,
  boundsRef: MutableRefObject<BoundingBox | null>,
): void {
  const stopsSource = map.getSource(STOPS_SOURCE_ID) as GeoJSONSource | undefined;
  if (stopsSource) {
    stopsSource.setData(data.stops);
  }

  const shapesSource = map.getSource(SHAPES_SOURCE_ID) as GeoJSONSource | undefined;
  if (shapesSource) {
    shapesSource.setData(data.shapes);
  }

  if (!data.bounds) {
    boundsRef.current = null;
    return;
  }

  if (boundsRef.current && areBoundsEqual(boundsRef.current, data.bounds)) {
    return;
  }

  map.fitBounds(data.bounds, { padding: MAP_FIT_PADDING, duration: 600 });
  boundsRef.current = data.bounds;
}

function areBoundsEqual(a: BoundingBox, b: BoundingBox): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

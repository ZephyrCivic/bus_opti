/**
 * src/features/explorer/MapView.tsx
 * Renders MapLibre GL map, updates overlays via service filters, and notifies selection events.
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import maplibregl, { Map, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { buildExplorerGeoJson, type BoundingBox, type ExplorerDataset } from './mapData';

const STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const STOPS_SOURCE_ID = 'explorer-stops';
const SHAPES_SOURCE_ID = 'explorer-shapes';
const STOPS_LAYER_ID = 'explorer-stops-layer';
const SHAPES_LAYER_ID = 'explorer-shapes-layer';
const MAP_FIT_PADDING = 48;
const DEFAULT_CENTER: [number, number] = [139.7671, 35.6812]; // Tokyo Station
const DEFAULT_ZOOM = 9;

export interface ExplorerMapSelection {
  type: 'stop' | 'shape';
  id: string;
}

interface MapViewProps {
  dataset: ExplorerDataset;
  onSelect: (selection: ExplorerMapSelection | null) => void;
}

export default function MapView({ dataset, onSelect }: MapViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const mapLoadedRef = useRef(false);
  const latestBoundsRef = useRef<BoundingBox | null>(null);
  const latestDatasetRef = useRef(dataset);

  useEffect(() => {
    latestDatasetRef.current = dataset;
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) {
      return;
    }
    applyExplorerData(map, dataset, latestBoundsRef);
  }, [dataset]);

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
      applyExplorerData(map, latestDatasetRef.current, latestBoundsRef);
    };

    const handleClick = (event: MapMouseEvent & maplibregl.EventData) => {
      const activeMap = mapRef.current;
      if (!activeMap || !mapLoadedRef.current) {
        return;
      }
      const selection = getSelectionFromEvent(activeMap, event);
      onSelect(selection);
    };

    map.on('load', handleLoad);
    map.on('click', handleClick);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    return () => {
      map.off('click', handleClick);
      map.off('load', handleLoad);
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      latestBoundsRef.current = null;
      onSelect(null);
    };
  }, [onSelect]);

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
  dataset: ExplorerDataset,
  boundsRef: MutableRefObject<BoundingBox | null>,
): void {
  const data = dataset.geoJson;
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

function getSelectionFromEvent(map: Map, event: MapMouseEvent): ExplorerMapSelection | null {
  const features = map.queryRenderedFeatures(event.point, { layers: [STOPS_LAYER_ID, SHAPES_LAYER_ID] });
  if (!features.length) {
    return null;
  }

  const stopFeature = features.find((candidate) => candidate.layer?.id === STOPS_LAYER_ID);
  if (stopFeature) {
    const properties = stopFeature.properties as Record<string, unknown> | null;
    const stopId = typeof properties?.stopId === 'string' ? properties.stopId : undefined;
    if (stopId) {
      return { type: 'stop', id: stopId };
    }
  }

  const shapeFeature = features.find((candidate) => candidate.layer?.id === SHAPES_LAYER_ID);
  if (shapeFeature) {
    const properties = shapeFeature.properties as Record<string, unknown> | null;
    const shapeId = typeof properties?.shapeId === 'string' ? properties.shapeId : undefined;
    if (shapeId) {
      return { type: 'shape', id: shapeId };
    }
  }

  return null;
}

function areBoundsEqual(a: BoundingBox, b: BoundingBox): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/**
 * src/features/explorer/MapView.tsx
 * Renders MapLibre GL map, updates overlays via service filters, and notifies selection events.
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Map, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { buildExplorerGeoJson, type BoundingBox, type ExplorerDataset } from './mapData';
import { loadMapLibre } from './loadMapLibre';

const STYLE_URL = 'https://tile.openstreetmap.jp/styles/osm-bright/style.json';
const STOPS_SOURCE_ID = 'explorer-stops';
const SHAPES_SOURCE_ID = 'explorer-shapes';
const STOPS_LAYER_ID = 'explorer-stops-layer';
const SHAPES_LAYER_ID = 'explorer-shapes-layer';
const DEPOTS_SOURCE_ID = 'explorer-depots';
const RELIEF_SOURCE_ID = 'explorer-relief';
const DEPOTS_LAYER_ID = 'explorer-depots-layer';
const RELIEF_LAYER_ID = 'explorer-relief-layer';
const MAP_FIT_PADDING = 48;
const DEFAULT_CENTER: [number, number] = [139.7671, 35.6812]; // Tokyo Station
const DEFAULT_ZOOM = 9;

export type ExplorerMapSelection =
  | { type: 'stop'; id: string }
  | { type: 'shape'; id: string }
  | { type: 'manualDepot'; id: string }
  | { type: 'manualRelief'; id: string };

interface MapViewProps {
  dataset: ExplorerDataset;
  onSelect: (selection: ExplorerMapSelection | null) => void;
  showDepots: boolean;
  showReliefPoints: boolean;
}

export default function MapView({ dataset, onSelect, showDepots, showReliefPoints }: MapViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const mapLoadedRef = useRef(false);
  const latestBoundsRef = useRef<BoundingBox | null>(null);
  const latestDatasetRef = useRef(dataset);
  const showDepotsRef = useRef(showDepots);
  const showReliefPointsRef = useRef(showReliefPoints);
  const missingImageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    latestDatasetRef.current = dataset;
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) {
      return;
    }
    applyExplorerData(map, dataset, latestBoundsRef);
    updateOverlayVisibility(map, showDepotsRef.current, showReliefPointsRef.current);
  }, [dataset]);

  useEffect(() => {
    showDepotsRef.current = showDepots;
    showReliefPointsRef.current = showReliefPoints;
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) {
      return;
    }
    updateOverlayVisibility(map, showDepots, showReliefPoints);
  }, [showDepots, showReliefPoints]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let cancelled = false;

    const handleLoad = () => {
      const activeMap = mapRef.current;
      if (!activeMap) {
        return;
      }
      mapLoadedRef.current = true;
      initializeSources(activeMap, latestDatasetRef.current, showDepotsRef.current, showReliefPointsRef.current);
      applyExplorerData(activeMap, latestDatasetRef.current, latestBoundsRef);
      updateOverlayVisibility(activeMap, showDepotsRef.current, showReliefPointsRef.current);
    };

    const handleClick = (event: MapMouseEvent) => {
      const activeMap = mapRef.current;
      if (!activeMap || !mapLoadedRef.current) {
        return;
      }
      const selection = getSelectionFromEvent(activeMap, event);
      onSelect(selection);
    };

    const mountMap = async () => {
      try {
        const maplibre = await loadMapLibre();
        if (cancelled || !containerRef.current) {
          return;
        }
        const map = new maplibre.Map({
          container: containerRef.current,
          style: STYLE_URL,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
        });
        mapRef.current = map;

        map.on('load', handleLoad);
        map.on('styleimagemissing', (event) => {
          const id = event.id;
          if (!id || missingImageIdsRef.current.has(id)) {
            return;
          }
          missingImageIdsRef.current.add(id);
          // MapLibre styles sometimes reference sprites that are not published.
          // Register a transparent placeholder so warnings do not flood the console.
          const width = 1;
          const height = 1;
          const transparentPixel = new Uint8Array([0, 0, 0, 0]);
          if (!map.hasImage(id)) {
            map.addImage(id, { width, height, data: transparentPixel });
          }
        });
        map.on('click', handleClick);
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      } catch (error) {
        console.error('MapLibre の読み込みに失敗しました', error);
      }
    };

    void mountMap();

    return () => {
      cancelled = true;
      const map = mapRef.current;
      if (map) {
        map.off('click', handleClick);
        map.off('load', handleLoad);
        map.remove();
      }
      mapRef.current = null;
      mapLoadedRef.current = false;
      latestBoundsRef.current = null;
      missingImageIdsRef.current.clear();
      onSelect(null);
    };
  }, [onSelect]);

  return <div ref={containerRef} className="h-[480px] w-full rounded-md border" />;
}

function initializeSources(
  map: Map,
  dataset: ExplorerDataset,
  showDepots: boolean,
  showReliefPoints: boolean,
): void {
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
        'circle-radius': 5,
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
        'line-color': '#2563eb',
        'line-width': 3,
        'line-opacity': 0.8,
      },
    });
  }

  if (!map.getSource(DEPOTS_SOURCE_ID)) {
    map.addSource(DEPOTS_SOURCE_ID, {
      type: 'geojson',
      data: dataset.manualOverlay.depots,
    });
    map.addLayer({
      id: DEPOTS_LAYER_ID,
      type: 'circle',
      source: DEPOTS_SOURCE_ID,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'dutyImpactCount'], 0],
          0,
          5,
          10,
          9,
          30,
          12,
        ],
        'circle-color': '#f97316',
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
      },
      layout: {
        visibility: showDepots ? 'visible' : 'none',
      },
    });
  }

  if (!map.getSource(RELIEF_SOURCE_ID)) {
    map.addSource(RELIEF_SOURCE_ID, {
      type: 'geojson',
      data: dataset.manualOverlay.reliefPoints,
    });
    map.addLayer({
      id: RELIEF_LAYER_ID,
      type: 'circle',
      source: RELIEF_SOURCE_ID,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'dutyImpactCount'], 0],
          0,
          5,
          10,
          9,
          30,
          12,
        ],
        'circle-color': '#10b981',
        'circle-stroke-width': 1,
        'circle-stroke-color': '#034d36',
      },
      layout: {
        visibility: showReliefPoints ? 'visible' : 'none',
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

  const depotsSource = map.getSource(DEPOTS_SOURCE_ID) as GeoJSONSource | undefined;
  if (depotsSource) {
    depotsSource.setData(dataset.manualOverlay.depots);
  }

  const reliefSource = map.getSource(RELIEF_SOURCE_ID) as GeoJSONSource | undefined;
  if (reliefSource) {
    reliefSource.setData(dataset.manualOverlay.reliefPoints);
  }

  const manualBounds = calculateManualOverlayBounds(dataset);
  const targetBounds = mergeBounds(data.bounds, manualBounds);

  if (!targetBounds) {
    boundsRef.current = null;
    return;
  }

  if (boundsRef.current && areBoundsEqual(boundsRef.current, targetBounds)) {
    return;
  }

  map.fitBounds(targetBounds, { padding: MAP_FIT_PADDING, duration: 600 });
  boundsRef.current = targetBounds;
}

function updateOverlayVisibility(map: Map, showDepots: boolean, showReliefPoints: boolean): void {
  if (map.getLayer(DEPOTS_LAYER_ID)) {
    map.setLayoutProperty(DEPOTS_LAYER_ID, 'visibility', showDepots ? 'visible' : 'none');
  }
  if (map.getLayer(RELIEF_LAYER_ID)) {
    map.setLayoutProperty(RELIEF_LAYER_ID, 'visibility', showReliefPoints ? 'visible' : 'none');
  }
}

function calculateManualOverlayBounds(dataset: ExplorerDataset): BoundingBox | null {
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  const include = (lon: number, lat: number) => {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  };

  for (const feature of dataset.manualOverlay.depots.features) {
    const [lon, lat] = feature.geometry.coordinates as [number, number];
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      include(lon, lat);
    }
  }

  for (const feature of dataset.manualOverlay.reliefPoints.features) {
    const [lon, lat] = feature.geometry.coordinates as [number, number];
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      include(lon, lat);
    }
  }

  if (!Number.isFinite(minLon) || !Number.isFinite(minLat) || !Number.isFinite(maxLon) || !Number.isFinite(maxLat)) {
    return null;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function mergeBounds(primary: BoundingBox | null, secondary: BoundingBox | null): BoundingBox | null {
  if (!primary && !secondary) {
    return null;
  }
  if (!primary) {
    return secondary;
  }
  if (!secondary) {
    return primary;
  }
  return [
    Math.min(primary[0], secondary[0]),
    Math.min(primary[1], secondary[1]),
    Math.max(primary[2], secondary[2]),
    Math.max(primary[3], secondary[3]),
  ];
}

function getSelectionFromEvent(map: Map, event: MapMouseEvent): ExplorerMapSelection | null {
  const features = map.queryRenderedFeatures(event.point, {
    layers: [DEPOTS_LAYER_ID, RELIEF_LAYER_ID, STOPS_LAYER_ID, SHAPES_LAYER_ID],
  });
  if (!features.length) {
    return null;
  }

  const depotFeature = features.find((candidate) => candidate.layer?.id === DEPOTS_LAYER_ID);
  if (depotFeature) {
    const properties = depotFeature.properties as Record<string, unknown> | null;
    const depotId = typeof properties?.depotId === 'string' ? properties.depotId : undefined;
    if (depotId) {
      return { type: 'manualDepot', id: depotId };
    }
  }

  const reliefFeature = features.find((candidate) => candidate.layer?.id === RELIEF_LAYER_ID);
  if (reliefFeature) {
    const properties = reliefFeature.properties as Record<string, unknown> | null;
    const reliefId = typeof properties?.reliefId === 'string' ? properties.reliefId : undefined;
    if (reliefId) {
      return { type: 'manualRelief', id: reliefId };
    }
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

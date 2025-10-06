/**
 * src/features/explorer/mapData.ts
 * Converts GTFS import tables into GeoJSON for Explorer map overlays.
 */
import type { Feature, FeatureCollection, LineString, Point, Position } from 'geojson';
import type { GtfsImportResult, GtfsTable } from '../../services/import/gtfsParser';

export type BoundingBox = [number, number, number, number];

export interface StopProperties {
  stopId: string;
  name?: string;
  code?: string;
}

export interface ShapeProperties {
  shapeId: string;
}

export interface ExplorerGeoJson {
  stops: FeatureCollection<Point, StopProperties>;
  shapes: FeatureCollection<LineString, ShapeProperties>;
  bounds: BoundingBox | null;
}

export function buildExplorerGeoJson(result?: GtfsImportResult): ExplorerGeoJson {
  if (!result) {
    return emptyExplorerGeoJson();
  }

  const stopsTable = result.tables['stops.txt'];
  const shapesTable = result.tables['shapes.txt'];

  const stopFeatures = stopsTable ? buildStopFeatures(stopsTable) : [];
  const shapeFeatures = shapesTable ? buildShapeFeatures(shapesTable) : [];

  const bounds = calculateBounds(stopFeatures, shapeFeatures);

  return {
    stops: createFeatureCollection(stopFeatures),
    shapes: createFeatureCollection(shapeFeatures),
    bounds,
  };
}

function emptyExplorerGeoJson(): ExplorerGeoJson {
  return {
    stops: createFeatureCollection<Point, StopProperties>([]),
    shapes: createFeatureCollection<LineString, ShapeProperties>([]),
    bounds: null,
  };
}

function createFeatureCollection<G extends Point | LineString, P extends Record<string, unknown>>(
  features: Feature<G, P>[],
): FeatureCollection<G, P> {
  return { type: 'FeatureCollection', features };
}

function buildStopFeatures(table: GtfsTable): Feature<Point, StopProperties>[] {
  const features: Feature<Point, StopProperties>[] = [];

  for (const row of table.rows) {
    const lat = toNumber(row.stop_lat);
    const lon = toNumber(row.stop_lon);
    if (lat === null || lon === null) {
      continue;
    }

    const stopId = (row.stop_id ?? '').trim();
    if (!stopId) {
      continue;
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        stopId,
        name: sanitizeOptional(row.stop_name),
        code: sanitizeOptional(row.stop_code),
      },
    });
  }

  return features;
}

interface ShapePoint {
  sequence: number;
  position: Position;
}

function buildShapeFeatures(table: GtfsTable): Feature<LineString, ShapeProperties>[] {
  const grouped = new Map<string, ShapePoint[]>();

  for (const row of table.rows) {
    const lat = toNumber(row.shape_pt_lat);
    const lon = toNumber(row.shape_pt_lon);
    if (lat === null || lon === null) {
      continue;
    }

    const shapeId = (row.shape_id ?? '').trim();
    if (!shapeId) {
      continue;
    }

    const sequence = toNumber(row.shape_pt_sequence);
    const points = grouped.get(shapeId) ?? [];
    points.push({
      sequence: sequence ?? Number.POSITIVE_INFINITY,
      position: [lon, lat],
    });
    grouped.set(shapeId, points);
  }

  const features: Feature<LineString, ShapeProperties>[] = [];

  for (const [shapeId, points] of grouped) {
    if (points.length < 2) {
      continue;
    }

    points.sort((a, b) => a.sequence - b.sequence);
    const coordinates = points.map((point) => point.position);

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: { shapeId },
    });
  }

  return features;
}

function calculateBounds(
  stops: Feature<Point, StopProperties>[],
  shapes: Feature<LineString, ShapeProperties>[],
): BoundingBox | null {
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  const expand = (lon: number, lat: number) => {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  };

  for (const feature of stops) {
    const [lon, lat] = feature.geometry.coordinates;
    expand(lon, lat);
  }

  for (const feature of shapes) {
    for (const [lon, lat] of feature.geometry.coordinates) {
      expand(lon, lat);
    }
  }

  if (!isFinite(minLon) || !isFinite(minLat) || !isFinite(maxLon) || !isFinite(maxLat)) {
    return null;
  }

  return [minLon, minLat, maxLon, maxLat];
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeOptional(value: string | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

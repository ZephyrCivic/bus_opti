/**
 * src/features/explorer/mapData.ts
 * Converts GTFS import tables into GeoJSON for Explorer map overlays and derives
 * service/day summaries for filtering and detail panels.
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

export interface ExplorerFilter {
  serviceId?: string | null;
}

export interface ExplorerServiceOption {
  serviceId: string;
  label: string;
  tripCount: number;
  stopCount: number;
}

export interface ExplorerStopDetail {
  stopId: string;
  name?: string;
  code?: string;
  latitude: number;
  longitude: number;
  totalTripCount: number;
  activeTripCount: number;
  serviceIds: string[];
}

export interface ExplorerShapeDetail {
  shapeId: string;
  tripCount: number;
  activeTripCount: number;
  serviceIds: string[];
}

export interface ExplorerDataset {
  geoJson: ExplorerGeoJson;
  services: ExplorerServiceOption[];
  stopDetails: Record<string, ExplorerStopDetail>;
  shapeDetails: Record<string, ExplorerShapeDetail>;
  selectedServiceId?: string;
}

export function buildExplorerDataset(result?: GtfsImportResult, filter?: ExplorerFilter): ExplorerDataset {
  const normalizedFilter = sanitizeId(filter?.serviceId ?? undefined) ?? undefined;
  if (!result) {
    return emptyExplorerDataset(normalizedFilter);
  }

  const stopsTable = result.tables['stops.txt'];
  const shapesTable = result.tables['shapes.txt'];
  const tripsTable = result.tables['trips.txt'];
  const stopTimesTable = result.tables['stop_times.txt'];

  const {
    allTripIds,
    tripServiceMap,
    serviceTripIds,
    serviceStopIds,
    serviceShapeIds,
    stopTripIds,
    shapeTripIds,
  } = buildRelationships(tripsTable, stopTimesTable);

  const services = buildServiceOptions(serviceTripIds, serviceStopIds);
  const selectedServiceId = normalizedFilter && services.some((service) => service.serviceId === normalizedFilter)
    ? normalizedFilter
    : undefined;

  let activeTripIds: Set<string>;
  if (selectedServiceId) {
    const serviceTrips = serviceTripIds.get(selectedServiceId);
    activeTripIds = serviceTrips ? new Set(serviceTrips) : new Set<string>();
  } else {
    activeTripIds = allTripIds;
  }

  const allowedStopIds = selectedServiceId ? serviceStopIds.get(selectedServiceId) ?? new Set<string>() : undefined;
  const allowedShapeIds = selectedServiceId ? serviceShapeIds.get(selectedServiceId) ?? new Set<string>() : undefined;

  const stopArtifacts = buildStopArtifacts({
    table: stopsTable,
    allowedStopIds,
    stopTripIds,
    tripServiceMap,
    activeTripIds,
  });

  const shapeArtifacts = buildShapeArtifacts({
    table: shapesTable,
    allowedShapeIds,
    shapeTripIds,
    tripServiceMap,
    activeTripIds,
  });

  const bounds = calculateBounds(stopArtifacts.features, shapeArtifacts.features);

  return {
    geoJson: {
      stops: createFeatureCollection(stopArtifacts.features),
      shapes: createFeatureCollection(shapeArtifacts.features),
      bounds,
    },
    services,
    stopDetails: stopArtifacts.details,
    shapeDetails: shapeArtifacts.details,
    selectedServiceId,
  };
}

export function buildExplorerGeoJson(result?: GtfsImportResult, filter?: ExplorerFilter): ExplorerGeoJson {
  return buildExplorerDataset(result, filter).geoJson;
}

function emptyExplorerDataset(selectedServiceId?: string): ExplorerDataset {
  return {
    geoJson: emptyExplorerGeoJson(),
    services: [],
    stopDetails: {},
    shapeDetails: {},
    selectedServiceId,
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

interface Relationships {
  allTripIds: Set<string>;
  tripServiceMap: Map<string, string | undefined>;
  serviceTripIds: Map<string, Set<string>>;
  serviceStopIds: Map<string, Set<string>>;
  serviceShapeIds: Map<string, Set<string>>;
  stopTripIds: Map<string, Set<string>>;
  shapeTripIds: Map<string, Set<string>>;
}

function buildRelationships(tripsTable?: GtfsTable, stopTimesTable?: GtfsTable): Relationships {
  const allTripIds = new Set<string>();
  const tripServiceMap = new Map<string, string | undefined>();
  const serviceTripIds = new Map<string, Set<string>>();
  const serviceStopIds = new Map<string, Set<string>>();
  const serviceShapeIds = new Map<string, Set<string>>();
  const stopTripIds = new Map<string, Set<string>>();
  const shapeTripIds = new Map<string, Set<string>>();

  if (tripsTable) {
    for (const row of tripsTable.rows) {
      const tripId = sanitizeId(row.trip_id);
      if (!tripId) {
        continue;
      }
      allTripIds.add(tripId);
      const serviceId = sanitizeId(row.service_id) ?? undefined;
      tripServiceMap.set(tripId, serviceId);
      if (serviceId) {
        ensureSet(serviceTripIds, serviceId).add(tripId);
      }
      const shapeId = sanitizeId(row.shape_id);
      if (shapeId) {
        ensureSet(shapeTripIds, shapeId).add(tripId);
        if (serviceId) {
          ensureSet(serviceShapeIds, serviceId).add(shapeId);
        }
      }
    }
  }

  if (stopTimesTable) {
    for (const row of stopTimesTable.rows) {
      const tripId = sanitizeId(row.trip_id);
      const stopId = sanitizeId(row.stop_id);
      if (!tripId || !stopId) {
        continue;
      }
      allTripIds.add(tripId);
      ensureSet(stopTripIds, stopId).add(tripId);
      const serviceId = tripServiceMap.get(tripId);
      if (serviceId) {
        ensureSet(serviceStopIds, serviceId).add(stopId);
      }
    }
  }

  return {
    allTripIds,
    tripServiceMap,
    serviceTripIds,
    serviceStopIds,
    serviceShapeIds,
    stopTripIds,
    shapeTripIds,
  };
}

interface StopArtifactOptions {
  table?: GtfsTable;
  allowedStopIds?: Set<string>;
  stopTripIds: Map<string, Set<string>>;
  tripServiceMap: Map<string, string | undefined>;
  activeTripIds: Set<string>;
}

interface StopArtifactsResult {
  features: Feature<Point, StopProperties>[];
  details: Record<string, ExplorerStopDetail>;
}

function buildStopArtifacts(options: StopArtifactOptions): StopArtifactsResult {
  const { table, allowedStopIds, stopTripIds, tripServiceMap, activeTripIds } = options;
  if (!table) {
    return { features: [], details: {} };
  }

  const features: Feature<Point, StopProperties>[] = [];
  const details: Record<string, ExplorerStopDetail> = {};

  for (const row of table.rows) {
    const lat = toNumber(row.stop_lat);
    const lon = toNumber(row.stop_lon);
    const stopId = sanitizeId(row.stop_id);
    if (lat === null || lon === null || !stopId) {
      continue;
    }
    if (allowedStopIds && !allowedStopIds.has(stopId)) {
      continue;
    }

    const name = sanitizeOptional(row.stop_name);
    const code = sanitizeOptional(row.stop_code);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        stopId,
        name,
        code,
      },
    });

    const tripIds = stopTripIds.get(stopId) ?? new Set<string>();
    const totalTripCount = tripIds.size;
    const activeTripCount = countMatchingTrips(tripIds, activeTripIds);
    const serviceSet = new Set<string>();
    for (const tripId of tripIds) {
      const serviceId = tripServiceMap.get(tripId);
      if (serviceId) {
        serviceSet.add(serviceId);
      }
    }

    details[stopId] = {
      stopId,
      name,
      code,
      latitude: lat,
      longitude: lon,
      totalTripCount,
      activeTripCount,
      serviceIds: Array.from(serviceSet).sort(localeCompareString),
    };
  }

  return { features, details };
}

interface ShapePoint {
  sequence: number;
  position: Position;
}

interface ShapeArtifactOptions {
  table?: GtfsTable;
  allowedShapeIds?: Set<string>;
  shapeTripIds: Map<string, Set<string>>;
  tripServiceMap: Map<string, string | undefined>;
  activeTripIds: Set<string>;
}

interface ShapeArtifactsResult {
  features: Feature<LineString, ShapeProperties>[];
  details: Record<string, ExplorerShapeDetail>;
}

function buildShapeArtifacts(options: ShapeArtifactOptions): ShapeArtifactsResult {
  const { table, allowedShapeIds, shapeTripIds, tripServiceMap, activeTripIds } = options;
  if (!table) {
    return { features: [], details: {} };
  }

  const grouped = new Map<string, ShapePoint[]>();

  for (const row of table.rows) {
    const lat = toNumber(row.shape_pt_lat);
    const lon = toNumber(row.shape_pt_lon);
    const shapeId = sanitizeId(row.shape_id);
    if (lat === null || lon === null || !shapeId) {
      continue;
    }
    if (allowedShapeIds && !allowedShapeIds.has(shapeId)) {
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
  const details: Record<string, ExplorerShapeDetail> = {};

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

    const tripIds = shapeTripIds.get(shapeId) ?? new Set<string>();
    const tripCount = tripIds.size;
    const activeTripCount = countMatchingTrips(tripIds, activeTripIds);
    const serviceSet = new Set<string>();
    for (const tripId of tripIds) {
      const serviceId = tripServiceMap.get(tripId);
      if (serviceId) {
        serviceSet.add(serviceId);
      }
    }

    details[shapeId] = {
      shapeId,
      tripCount,
      activeTripCount,
      serviceIds: Array.from(serviceSet).sort(localeCompareString),
    };
  }

  return { features, details };
}

function buildServiceOptions(
  serviceTripIds: Map<string, Set<string>>,
  serviceStopIds: Map<string, Set<string>>,
): ExplorerServiceOption[] {
  const options: ExplorerServiceOption[] = [];
  for (const [serviceId, tripIds] of serviceTripIds) {
    options.push({
      serviceId,
      label: serviceId,
      tripCount: tripIds.size,
      stopCount: serviceStopIds.get(serviceId)?.size ?? 0,
    });
  }
  options.sort((a, b) => localeCompareString(a.serviceId, b.serviceId));
  return options;
}

function localeCompareString(a: string, b: string): number {
  return a.localeCompare(b, 'ja-JP-u-nu-latn');
}

function ensureSet<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const created = new Set<V>();
  map.set(key, created);
  return created;
}

function countMatchingTrips(tripIds: Iterable<string>, activeTripIds: Set<string>): number {
  let matched = 0;
  for (const tripId of tripIds) {
    if (activeTripIds.has(tripId)) {
      matched += 1;
    }
  }
  return matched;
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

function sanitizeId(value: string | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeOptional(value: string | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

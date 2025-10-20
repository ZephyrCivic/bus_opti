/**
 * src/features/explorer/mapData.ts
 * Converts GTFS import tables into GeoJSON for Explorer map overlays and derives
 * service/day summaries for filtering and detail panels.
 */
import type { Feature, FeatureCollection, LineString, Point, Position } from 'geojson';
import type { ManualInputs, Duty } from '@/types';
import type { BlockPlan } from '@/services/blocks/blockBuilder';
import type { GtfsImportResult, GtfsTable } from '../../services/import/gtfsParser';

export type BoundingBox = [number, number, number, number];

export interface StopProperties extends Record<string, unknown> {
  stopId: string;
  name?: string;
  code?: string;
}

export interface ShapeProperties extends Record<string, unknown> {
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
  manualOverlay: ExplorerManualOverlay;
  manualSummary: ExplorerManualSummary;
  routes: Record<string, ExplorerRouteDetail>;
  routeOptions: ExplorerRouteOption[];
  alerts: string[];
}

export interface ExplorerManualOverlay {
  depots: FeatureCollection<Point, DepotOverlayProperties>;
  reliefPoints: FeatureCollection<Point, ReliefPointOverlayProperties>;
}

export interface DepotOverlayProperties extends Record<string, unknown> {
  depotId: string;
  name?: string;
  dutyImpactCount: number;
}

export interface ReliefPointOverlayProperties extends Record<string, unknown> {
  reliefId: string;
  name?: string;
  stopId?: string;
  dutyImpactCount: number;
}

export interface ExplorerManualSummary {
  depotCount: number;
  reliefPointCount: number;
  totalDutyImpacts: number;
}

export interface ExplorerRouteOption {
  routeId: string;
  label: string;
  shortName?: string;
  longName?: string;
  color?: string;
  textColor?: string;
  directionIds: string[];
  tripCount: number;
  stopCount: number;
}

export interface ExplorerTimelineTrip {
  tripId: string;
  headsign?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  stopCount: number;
  serviceId?: string;
}

export interface ExplorerRouteDirectionDetail {
  directionId: string;
  headsigns: string[];
  tripCount: number;
  earliestDeparture?: string;
  latestArrival?: string;
  trips: ExplorerTimelineTrip[];
}

export interface ExplorerRouteDetail {
  routeId: string;
  shortName?: string;
  longName?: string;
  color?: string;
  textColor?: string;
  tripCount: number;
  stopCount: number;
  directions: Record<string, ExplorerRouteDirectionDetail>;
}

export interface ExplorerDatasetOptions {
  filter?: ExplorerFilter;
  manual?: ManualInputs;
  duties?: Duty[];
  blockPlan?: BlockPlan;
}

export function buildExplorerDataset(result?: GtfsImportResult, options?: ExplorerDatasetOptions): ExplorerDataset {
  const normalizedFilter = sanitizeId(options?.filter?.serviceId ?? undefined) ?? undefined;
  const manual = options?.manual;
  const duties = options?.duties ?? [];
  const blockPlan = options?.blockPlan;
  if (!result) {
    return emptyExplorerDataset(normalizedFilter, manual);
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

  const tripStopLookup = buildTripStopLookup(blockPlan);
  const dutyStopUsage = computeDutyStopUsage(duties, tripStopLookup);
  const manualOverlay = buildManualOverlay(manual, dutyStopUsage);
  const manualSummary = buildManualSummary(manualOverlay);

  const routeArtifacts = buildRouteSummaries({
    routesTable: result.tables['routes.txt'],
    tripsTable,
    stopTimesTable,
    activeTripIds,
    tripServiceMap,
  });

  const alerts = Array.isArray(result.alerts) ? result.alerts : [];

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
    manualOverlay,
    manualSummary,
    routes: routeArtifacts.details,
    routeOptions: routeArtifacts.options,
    alerts,
  };
}

export function buildExplorerGeoJson(result?: GtfsImportResult, filter?: ExplorerFilter): ExplorerGeoJson {
  return buildExplorerDataset(result, { filter }).geoJson;
}

function emptyExplorerDataset(selectedServiceId?: string, manual?: ManualInputs): ExplorerDataset {
  const manualOverlay = buildManualOverlay(manual, new Map());
  return {
    geoJson: emptyExplorerGeoJson(),
    services: [],
    stopDetails: {},
    shapeDetails: {},
    selectedServiceId,
    manualOverlay,
    manualSummary: buildManualSummary(manualOverlay),
    routes: {},
    routeOptions: [],
    alerts: [],
  };
}

function emptyExplorerGeoJson(): ExplorerGeoJson {
  return {
    stops: createFeatureCollection<Point, StopProperties>([]),
    shapes: createFeatureCollection<LineString, ShapeProperties>([]),
    bounds: null,
  };
}

type TripStopLookup = Map<string, TripStopSpan>;

interface TripStopSpan {
  startStopId?: string;
  endStopId?: string;
}

function buildTripStopLookup(blockPlan?: BlockPlan): TripStopLookup {
  const lookup: TripStopLookup = new Map();
  if (!blockPlan) {
    return lookup;
  }

  for (const row of blockPlan.csvRows) {
    const tripId = sanitizeId(row.tripId);
    if (!tripId) {
      continue;
    }
    const span = lookup.get(tripId) ?? {};
    const fromStop = sanitizeId(row.fromStopId);
    if (fromStop && span.startStopId === undefined) {
      span.startStopId = fromStop;
    }
    const toStop = sanitizeId(row.toStopId);
    if (toStop && span.endStopId === undefined) {
      span.endStopId = toStop;
    }
    lookup.set(tripId, span);
  }

  return lookup;
}

function computeDutyStopUsage(duties: Duty[], tripStops: TripStopLookup): Map<string, number> {
  const counts = new Map<string, number>();
  for (const duty of duties) {
    for (const segment of duty.segments) {
      const touched = new Set<string>();
      const startSpan = tripStops.get(segment.startTripId);
      if (startSpan?.startStopId) {
        touched.add(startSpan.startStopId);
      }
      if (startSpan?.endStopId) {
        touched.add(startSpan.endStopId);
      }
      const endSpan = tripStops.get(segment.endTripId);
      if (endSpan?.startStopId) {
        touched.add(endSpan.startStopId);
      }
      if (endSpan?.endStopId) {
        touched.add(endSpan.endStopId);
      }
      for (const stopId of touched) {
        incrementCount(counts, stopId);
      }
    }
  }
  return counts;
}

function buildManualOverlay(manual: ManualInputs | undefined, dutyStopUsage: Map<string, number>): ExplorerManualOverlay {
  if (!manual) {
    return {
      depots: createFeatureCollection<Point, DepotOverlayProperties>([]),
      reliefPoints: createFeatureCollection<Point, ReliefPointOverlayProperties>([]),
    };
  }

  const deadheadCounts = new Map<string, number>();
  for (const rule of manual.deadheadRules) {
    const fromId = sanitizeId(rule.fromId);
    if (fromId) {
      incrementCount(deadheadCounts, fromId);
    }
    const toId = sanitizeId(rule.toId);
    if (toId) {
      incrementCount(deadheadCounts, toId);
    }
  }

  const depotFeatures: Feature<Point, DepotOverlayProperties>[] = [];
  for (const depot of manual.depots) {
    if (!Number.isFinite(depot.lat) || !Number.isFinite(depot.lon)) {
      continue;
    }
    const dutyImpactCount = deadheadCounts.get(depot.depotId) ?? 0;
    depotFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [depot.lon, depot.lat] },
      properties: {
        depotId: depot.depotId,
        name: depot.name,
        dutyImpactCount,
      },
    });
  }

  const reliefFeatures: Feature<Point, ReliefPointOverlayProperties>[] = [];
  for (const relief of manual.reliefPoints) {
    if (!Number.isFinite(relief.lat) || !Number.isFinite(relief.lon)) {
      continue;
    }
    const stopId = relief.stopId ? sanitizeId(relief.stopId) ?? undefined : undefined;
    const stopImpact = stopId ? dutyStopUsage.get(stopId) ?? 0 : 0;
    const deadheadImpact = deadheadCounts.get(relief.reliefId) ?? 0;
    const dutyImpactCount = stopImpact + deadheadImpact;
    reliefFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [relief.lon, relief.lat] },
      properties: {
        reliefId: relief.reliefId,
        name: relief.name,
        stopId,
        dutyImpactCount,
      },
    });
  }

  return {
    depots: createFeatureCollection(depotFeatures),
    reliefPoints: createFeatureCollection(reliefFeatures),
  };
}

function buildManualSummary(overlay: ExplorerManualOverlay): ExplorerManualSummary {
  const depotImpacts = overlay.depots.features.reduce((sum, feature) => sum + (feature.properties?.dutyImpactCount ?? 0), 0);
  const reliefImpacts = overlay.reliefPoints.features.reduce((sum, feature) => sum + (feature.properties?.dutyImpactCount ?? 0), 0);
  return {
    depotCount: overlay.depots.features.length,
    reliefPointCount: overlay.reliefPoints.features.length,
    totalDutyImpacts: depotImpacts + reliefImpacts,
  };
}

function createFeatureCollection<G extends Point | LineString, P extends Record<string, unknown>>(
  features: Feature<G, P>[],
): FeatureCollection<G, P> {
  return { type: 'FeatureCollection', features };
}

function incrementCount(map: Map<string, number>, key: string, amount = 1): void {
  const next = (map.get(key) ?? 0) + amount;
  map.set(key, next);
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

interface RouteSummaryOptions {
  routesTable?: GtfsTable;
  tripsTable?: GtfsTable;
  stopTimesTable?: GtfsTable;
  activeTripIds: Set<string>;
  tripServiceMap: Map<string, string | undefined>;
}

interface RouteSummaryArtifacts {
  details: Record<string, ExplorerRouteDetail>;
  options: ExplorerRouteOption[];
}

interface RouteMeta {
  shortName?: string;
  longName?: string;
  color?: string;
  textColor?: string;
}

interface RouteAggregate {
  meta: RouteMeta;
  tripCount: number;
  stopIds: Set<string>;
  directions: Map<string, DirectionAggregate>;
}

interface DirectionAggregate {
  directionId: string;
  headsigns: Set<string>;
  tripCount: number;
  earliestStart: number | null;
  latestEnd: number | null;
  trips: TripAggregate[];
}

interface TripAggregate {
  tripId: string;
  headsign?: string;
  startMinutes: number | null;
  endMinutes: number | null;
  stopCount: number;
  serviceId?: string;
}

interface TripTiming {
  startMinutes: number | null;
  endMinutes: number | null;
  stopCount: number;
  stopIds: Set<string>;
}

function buildRouteSummaries(options: RouteSummaryOptions): RouteSummaryArtifacts {
  const { routesTable, tripsTable, stopTimesTable, activeTripIds, tripServiceMap } = options;

  if (!tripsTable || tripsTable.rows.length === 0 || activeTripIds.size === 0) {
    return { details: {}, options: [] };
  }

  const routeMeta = new Map<string, RouteMeta>();
  if (routesTable) {
    for (const row of routesTable.rows) {
      const routeId = sanitizeId(row.route_id);
      if (!routeId) {
        continue;
      }
      routeMeta.set(routeId, {
        shortName: sanitizeOptional(row.route_short_name),
        longName: sanitizeOptional(row.route_long_name),
        color: sanitizeHexColor(row.route_color),
        textColor: sanitizeHexColor(row.route_text_color),
      });
    }
  }

  const tripTimings = computeTripTimings(stopTimesTable);
  const aggregates = new Map<string, RouteAggregate>();

  for (const row of tripsTable.rows) {
    const tripId = sanitizeId(row.trip_id);
    if (!tripId || !activeTripIds.has(tripId)) {
      continue;
    }
    const routeId = sanitizeId(row.route_id);
    if (!routeId) {
      continue;
    }

    const routeInfo = routeMeta.get(routeId) ?? {};
    let aggregate = aggregates.get(routeId);
    if (!aggregate) {
      aggregate = {
        meta: routeInfo,
        tripCount: 0,
        stopIds: new Set<string>(),
        directions: new Map<string, DirectionAggregate>(),
      };
      aggregates.set(routeId, aggregate);
    }
    aggregate.tripCount += 1;

    const directionId = sanitizeId(row.direction_id) ?? '0';
    let direction = aggregate.directions.get(directionId);
    if (!direction) {
      direction = {
        directionId,
        headsigns: new Set<string>(),
        tripCount: 0,
        earliestStart: null,
        latestEnd: null,
        trips: [],
      };
      aggregate.directions.set(directionId, direction);
    }
    direction.tripCount += 1;

    const headsign = sanitizeOptional(row.trip_headsign);
    if (headsign) {
      direction.headsigns.add(headsign);
    }

    const timing = tripTimings.get(tripId);
    if (timing) {
      for (const stopId of timing.stopIds) {
        aggregate.stopIds.add(stopId);
      }
      if (timing.startMinutes !== null) {
        if (direction.earliestStart === null || timing.startMinutes < direction.earliestStart) {
          direction.earliestStart = timing.startMinutes;
        }
      }
      if (timing.endMinutes !== null) {
        if (direction.latestEnd === null || timing.endMinutes > direction.latestEnd) {
          direction.latestEnd = timing.endMinutes;
        }
      }
    }

    const serviceId = tripServiceMap.get(tripId) ?? undefined;

    direction.trips.push({
      tripId,
      headsign: headsign ?? undefined,
      startMinutes: timing?.startMinutes ?? null,
      endMinutes: timing?.endMinutes ?? null,
      stopCount: timing?.stopCount ?? 0,
      serviceId,
    });
  }

  const details: Record<string, ExplorerRouteDetail> = {};
  const options: ExplorerRouteOption[] = [];

  for (const [routeId, aggregate] of aggregates) {
    if (aggregate.tripCount === 0) {
      continue;
    }

    const directionEntries = Array.from(aggregate.directions.entries());
    directionEntries.sort((a, b) => localeCompareString(a[0], b[0]));

    const directionIds: string[] = [];
    const directionDetails: Record<string, ExplorerRouteDirectionDetail> = {};

    for (const [directionId, dirAggregate] of directionEntries) {
      directionIds.push(directionId);
      dirAggregate.trips.sort((a, b) => {
        const aStart = a.startMinutes ?? Number.POSITIVE_INFINITY;
        const bStart = b.startMinutes ?? Number.POSITIVE_INFINITY;
        if (aStart !== bStart) {
          return aStart - bStart;
        }
        return localeCompareString(a.tripId, b.tripId);
      });

      const trips: ExplorerTimelineTrip[] = dirAggregate.trips.map((trip) => {
        const duration = trip.startMinutes !== null && trip.endMinutes !== null
          ? Math.max(Math.round(trip.endMinutes - trip.startMinutes), 0)
          : undefined;
        return {
          tripId: trip.tripId,
          headsign: trip.headsign,
          startTime: formatMinutesAsTime(trip.startMinutes),
          endTime: formatMinutesAsTime(trip.endMinutes),
          durationMinutes: duration,
          stopCount: trip.stopCount,
          serviceId: trip.serviceId,
        };
      });

      directionDetails[directionId] = {
        directionId,
        headsigns: Array.from(dirAggregate.headsigns).sort((a, b) => a.localeCompare(b, 'ja-JP-u-nu-latn')),
        tripCount: dirAggregate.tripCount,
        earliestDeparture: formatMinutesAsTime(dirAggregate.earliestStart),
        latestArrival: formatMinutesAsTime(dirAggregate.latestEnd),
        trips,
      };
    }

    const meta = aggregate.meta;
    details[routeId] = {
      routeId,
      shortName: meta.shortName,
      longName: meta.longName,
      color: meta.color,
      textColor: meta.textColor,
      tripCount: aggregate.tripCount,
      stopCount: aggregate.stopIds.size,
      directions: directionDetails,
    };

    options.push({
      routeId,
      label: buildRouteLabel(routeId, meta),
      shortName: meta.shortName,
      longName: meta.longName,
      color: meta.color,
      textColor: meta.textColor,
      directionIds,
      tripCount: aggregate.tripCount,
      stopCount: aggregate.stopIds.size,
    });
  }

  options.sort((a, b) => a.label.localeCompare(b.label, 'ja-JP-u-nu-latn'));

  return { details, options };
}

function computeTripTimings(stopTimesTable?: GtfsTable): Map<string, TripTiming> {
  const timings = new Map<string, TripTiming>();
  if (!stopTimesTable) {
    return timings;
  }

  const grouped = new Map<string, Record<string, string>[]>();
  for (const row of stopTimesTable.rows) {
    const tripId = sanitizeId(row.trip_id);
    if (!tripId) {
      continue;
    }
    const group = grouped.get(tripId);
    if (group) {
      group.push(row);
    } else {
      grouped.set(tripId, [row]);
    }
  }

  for (const [tripId, rows] of grouped) {
    rows.sort((a, b) => {
      const seqA = Number.parseInt(String((a as Record<string, string>).stop_sequence ?? '0'), 10);
      const seqB = Number.parseInt(String((b as Record<string, string>).stop_sequence ?? '0'), 10);
      const safeA = Number.isFinite(seqA) ? seqA : 0;
      const safeB = Number.isFinite(seqB) ? seqB : 0;
      return safeA - safeB;
    });

    let startMinutes: number | null = null;
    let endMinutes: number | null = null;
    const stopIds = new Set<string>();
    let stopCount = 0;

    for (const row of rows) {
      stopCount += 1;
      const stopId = sanitizeId(row.stop_id);
      if (stopId) {
        stopIds.add(stopId);
      }
      const departure = parseTimeToMinutes(row.departure_time);
      const arrival = parseTimeToMinutes(row.arrival_time);

      const candidateStart = departure ?? arrival;
      if (candidateStart !== null && candidateStart !== undefined) {
        if (startMinutes === null || candidateStart < startMinutes) {
          startMinutes = candidateStart;
        }
      }

      const candidateEnd = arrival ?? departure;
      if (candidateEnd !== null && candidateEnd !== undefined) {
        if (endMinutes === null || candidateEnd > endMinutes) {
          endMinutes = candidateEnd;
        }
      }
    }

    timings.set(tripId, {
      startMinutes,
      endMinutes,
      stopCount,
      stopIds,
    });
  }

  return timings;
}

function parseTimeToMinutes(value: string | undefined): number | null {
  const normalized = sanitizeOptional(value);
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/^(-?\d+):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes >= 60) {
    return null;
  }
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 60) {
    return null;
  }
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return totalSeconds / 60;
}

function formatMinutesAsTime(value: number | null | undefined): string | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  const totalMinutes = Math.round(value);
  const hours = Math.trunc(totalMinutes / 60);
  const minutes = Math.abs(totalMinutes % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function sanitizeHexColor(value: string | undefined): string | undefined {
  const normalized = sanitizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  const hex = normalized.replace(/^#/u, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(hex) ? `#${hex}` : undefined;
}

function buildRouteLabel(routeId: string, meta?: RouteMeta): string {
  const shortName = meta?.shortName;
  const longName = meta?.longName;
  if (shortName && longName) {
    return `${shortName} · ${longName}`;
  }
  return shortName ?? longName ?? routeId;
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

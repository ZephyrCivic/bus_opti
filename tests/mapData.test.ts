/**
 * tests/mapData.test.ts
 * Unit tests for GTFS → GeoJSON transformation used by Explorer map overlay.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExplorerDataset, buildExplorerGeoJson } from '../src/features/explorer/mapData';
import type { GtfsImportResult } from '../src/services/import/gtfsParser';
import type { ManualInputs, Duty } from '../src/types';
import type { BlockPlan } from '../src/services/blocks/blockBuilder';

function baseResult(): GtfsImportResult {
  return {
    sourceName: 'sample.zip',
    importedAt: new Date('2025-10-01T00:00:00Z'),
    tables: {
      'stops.txt': { name: 'stops.txt', rows: [] },
      'trips.txt': { name: 'trips.txt', rows: [] },
      'stop_times.txt': { name: 'stop_times.txt', rows: [] },
    },
    missingFiles: [],
    summary: [],
    alerts: [],
  } as GtfsImportResult;
}

test('buildExplorerGeoJson converts stops and shapes with bounds', () => {
  const result = baseResult();
  result.tables['stops.txt'].rows = [
    { stop_id: 'STOP_A', stop_name: ' Alpha ', stop_lat: '35.60', stop_lon: '139.70' },
    { stop_id: 'STOP_B', stop_name: 'Beta', stop_code: 'B1', stop_lat: '35.62', stop_lon: '139.82' },
    { stop_id: '', stop_lat: '35.00', stop_lon: '140.00' },
  ];
  result.tables['shapes.txt'] = {
    name: 'shapes.txt',
    rows: [
      { shape_id: 'SHAPE_1', shape_pt_lat: '35.60', shape_pt_lon: '139.70', shape_pt_sequence: '2' },
      { shape_id: 'SHAPE_1', shape_pt_lat: '35.62', shape_pt_lon: '139.72', shape_pt_sequence: '3' },
      { shape_id: 'SHAPE_1', shape_pt_lat: '35.61', shape_pt_lon: '139.71', shape_pt_sequence: '1' },
      { shape_id: 'SHAPE_2', shape_pt_lat: '35.62', shape_pt_lon: '139.82', shape_pt_sequence: '1' },
      { shape_id: 'SHAPE_2', shape_pt_lat: '35.61', shape_pt_lon: '139.81', shape_pt_sequence: '2' },
      { shape_id: '', shape_pt_lat: '0', shape_pt_lon: '0', shape_pt_sequence: '0' },
      { shape_id: 'SHAPE_2', shape_pt_lat: 'not-a-number', shape_pt_lon: '139.90', shape_pt_sequence: '3' },
    ],
  };

  const geo = buildExplorerGeoJson(result);

  assert.equal(geo.stops.features.length, 2, 'invalid stops should be ignored');
  const stopIds = geo.stops.features.map((feature) => feature.properties?.stopId);
  assert.deepEqual(stopIds, ['STOP_A', 'STOP_B']);
  assert.equal(geo.stops.features[0].properties?.name, 'Alpha');
  assert.equal(geo.stops.features[1].properties?.code, 'B1');

  assert.equal(geo.shapes.features.length, 2, 'shape groups should be preserved');
  const coordinates = geo.shapes.features[0].geometry.coordinates;
  assert.deepEqual(coordinates, [
    [139.71, 35.61],
    [139.70, 35.6],
    [139.72, 35.62],
  ]);

  assert.deepEqual(geo.bounds, [139.7, 35.6, 139.82, 35.62]);
});

test('buildExplorerGeoJson handles missing shapes gracefully', () => {
  const result = baseResult();
  result.tables['stops.txt'].rows = [
    { stop_id: 'STOP_ONLY', stop_name: 'Solo', stop_lat: '34.50', stop_lon: '135.50' },
  ];

  const geo = buildExplorerGeoJson(result);

  assert.equal(geo.shapes.features.length, 0);
  assert.deepEqual(geo.bounds, [135.5, 34.5, 135.5, 34.5]);
});

test('buildExplorerGeoJson returns empty collections when result is undefined', () => {
  const geo = buildExplorerGeoJson();
  assert.equal(geo.stops.features.length, 0);
  assert.equal(geo.shapes.features.length, 0);
  assert.equal(geo.bounds, null);
});

test('buildExplorerDataset exposes services and applies serviceId filter', () => {
  const result = baseResult();
  result.tables['stops.txt'].rows = [
    { stop_id: 'STOP_A', stop_name: 'A', stop_lat: '35.6', stop_lon: '139.7' },
    { stop_id: 'STOP_B', stop_name: 'B', stop_lat: '35.61', stop_lon: '139.71' },
    { stop_id: 'STOP_C', stop_name: 'C', stop_lat: '35.62', stop_lon: '139.72' },
  ];
  result.tables['trips.txt'].rows = [
    { trip_id: 'TRIP_A', service_id: 'WEEKDAY', shape_id: 'SHAPE_1' },
    { trip_id: 'TRIP_B', service_id: 'WEEKEND', shape_id: 'SHAPE_2' },
    { trip_id: 'TRIP_C', service_id: 'WEEKDAY', shape_id: 'SHAPE_1' },
  ];
  result.tables['stop_times.txt'].rows = [
    { trip_id: 'TRIP_A', stop_id: 'STOP_A' },
    { trip_id: 'TRIP_A', stop_id: 'STOP_B' },
    { trip_id: 'TRIP_B', stop_id: 'STOP_B' },
    { trip_id: 'TRIP_B', stop_id: 'STOP_C' },
    { trip_id: 'TRIP_C', stop_id: 'STOP_A' },
  ];
  result.tables['shapes.txt'] = {
    name: 'shapes.txt',
    rows: [
      { shape_id: 'SHAPE_1', shape_pt_lat: '35.60', shape_pt_lon: '139.70', shape_pt_sequence: '1' },
      { shape_id: 'SHAPE_1', shape_pt_lat: '35.61', shape_pt_lon: '139.71', shape_pt_sequence: '2' },
      { shape_id: 'SHAPE_1', shape_pt_lat: '35.62', shape_pt_lon: '139.72', shape_pt_sequence: '3' },
      { shape_id: 'SHAPE_2', shape_pt_lat: '35.60', shape_pt_lon: '139.80', shape_pt_sequence: '1' },
      { shape_id: 'SHAPE_2', shape_pt_lat: '35.62', shape_pt_lon: '139.82', shape_pt_sequence: '2' },
    ],
  };

  const datasetAll = buildExplorerDataset(result);
  assert.equal(datasetAll.services.length, 2);
  assert.equal(datasetAll.geoJson.stops.features.length, 3);
  assert.equal(datasetAll.geoJson.shapes.features.length, 2);
  assert.equal(datasetAll.stopDetails['STOP_B'].totalTripCount, 2);

  const weekday = buildExplorerDataset(result, { filter: { serviceId: 'WEEKDAY' } });
  assert.equal(weekday.selectedServiceId, 'WEEKDAY');
  assert.equal(weekday.geoJson.stops.features.length, 2, 'weekday should include stops used by weekday trips');
  assert.equal(weekday.geoJson.shapes.features.length, 1, 'weekday should include only shape 1');
  assert.equal(weekday.stopDetails['STOP_B'].activeTripCount, 1, 'STOP_B has one weekday trip');
  assert.equal(weekday.shapeDetails['SHAPE_1'].activeTripCount, 2, 'shape 1 has two weekday trips');

  const weekend = buildExplorerDataset(result, { filter: { serviceId: 'WEEKEND' } });
  assert.equal(weekend.geoJson.stops.features.length, 2, 'weekend should include STOP_B and STOP_C');
  assert.equal(weekend.geoJson.shapes.features.length, 1, 'weekend should include only shape 2');
  assert.equal(weekend.stopDetails['STOP_C'].activeTripCount, 1);
  assert.deepEqual(weekend.stopDetails['STOP_A'], undefined, 'STOP_A not present for weekend');

  const unknown = buildExplorerDataset(result, { filter: { serviceId: 'UNKNOWN' } });
  assert.equal(unknown.selectedServiceId, undefined, 'unknown service falls back to all');
  assert.equal(unknown.geoJson.stops.features.length, 3);
});

test('buildExplorerDataset aggregates manual overlay duty impacts', () => {
  const result = baseResult();
  result.tables['stops.txt'].rows = [
    { stop_id: 'STOP_A', stop_name: 'A', stop_lat: '35.60', stop_lon: '139.70' },
    { stop_id: 'STOP_B', stop_name: 'B', stop_lat: '35.61', stop_lon: '139.71' },
    { stop_id: 'STOP_C', stop_name: 'C', stop_lat: '35.62', stop_lon: '139.72' },
  ];
  result.tables['trips.txt'].rows = [
    { trip_id: 'TRIP_START', service_id: 'WEEKDAY', shape_id: 'SHAPE_MANUAL' },
    { trip_id: 'TRIP_END', service_id: 'WEEKDAY', shape_id: 'SHAPE_MANUAL' },
  ];
  result.tables['stop_times.txt'].rows = [
    { trip_id: 'TRIP_START', stop_id: 'STOP_A' },
    { trip_id: 'TRIP_START', stop_id: 'STOP_B' },
    { trip_id: 'TRIP_END', stop_id: 'STOP_B' },
    { trip_id: 'TRIP_END', stop_id: 'STOP_C' },
  ];

  const manual: ManualInputs = {
    depots: [{
      depotId: 'DEPOT_MAIN',
      name: 'Main Depot',
      lat: 35.59,
      lon: 139.69,
      minTurnaroundMin: 10,
    }],
    reliefPoints: [{
      reliefId: 'RELIEF_1',
      name: 'Relief Stop',
      lat: 35.61,
      lon: 139.71,
      stopId: 'STOP_B',
    }],
    deadheadRules: [
      { fromId: 'DEPOT_MAIN', toId: 'RELIEF_1', mode: 'bus', travelTimeMin: 12 },
      { fromId: 'RELIEF_1', toId: 'DEPOT_MAIN', mode: 'bus', travelTimeMin: 15 },
    ],
    drivers: [{ driverId: 'DRV1', name: 'Driver One' }],
    linking: { enabled: true, minTurnaroundMin: 10, maxConnectRadiusM: 100, allowParentStation: true },
  };

  const duties: Duty[] = [{
    id: 'DUTY_1',
    segments: [{
      id: 'SEG_1',
      blockId: 'BLOCK_1',
      startTripId: 'TRIP_START',
      endTripId: 'TRIP_END',
      startSequence: 1,
      endSequence: 2,
    }],
  }];

  const plan: BlockPlan = {
    summaries: [],
    csvRows: [
      {
        blockId: 'BLOCK_1',
        seq: 1,
        tripId: 'TRIP_START',
        tripStart: '08:00',
        tripEnd: '08:30',
        fromStopId: 'STOP_A',
        toStopId: 'STOP_B',
        serviceId: 'WEEKDAY',
      },
      {
        blockId: 'BLOCK_1',
        seq: 2,
        tripId: 'TRIP_END',
        tripStart: '08:30',
        tripEnd: '09:10',
        fromStopId: 'STOP_B',
        toStopId: 'STOP_C',
        serviceId: 'WEEKDAY',
      },
    ],
    unassignedTripIds: [],
    totalTripCount: 2,
    assignedTripCount: 2,
    coverageRatio: 1,
    maxTurnGapMinutes: 15,
  };

  const dataset = buildExplorerDataset(result, {
    manual,
    duties,
    blockPlan: plan,
  });

  const depotFeatures = dataset.manualOverlay.depots.features;
  const reliefFeatures = dataset.manualOverlay.reliefPoints.features;
  assert.equal(depotFeatures.length, 1);
  assert.equal(reliefFeatures.length, 1);
  assert.equal(depotFeatures[0]?.properties?.dutyImpactCount, 2, 'deadhead rules counted for depots');
  assert.equal(reliefFeatures[0]?.properties?.dutyImpactCount, 3, 'deadhead + duty stop usage counted');
  assert.equal(dataset.manualSummary.depotCount, 1);
  assert.equal(dataset.manualSummary.reliefPointCount, 1);
  assert.equal(dataset.manualSummary.totalDutyImpacts, 5);
});

test('buildExplorerDataset summarizes routes and timelines', () => {
  const result = baseResult();
  result.tables['stops.txt'].rows = [
    { stop_id: 'STOP_A', stop_name: 'A', stop_lat: '35.60', stop_lon: '139.70' },
    { stop_id: 'STOP_B', stop_name: 'B', stop_lat: '35.61', stop_lon: '139.71' },
    { stop_id: 'STOP_C', stop_name: 'C', stop_lat: '35.62', stop_lon: '139.72' },
  ];
  result.tables['trips.txt'].rows = [
    { trip_id: 'TRIP_1', service_id: 'WEEKDAY', route_id: 'R-01', direction_id: '0', trip_headsign: 'Outbound' },
    { trip_id: 'TRIP_2', service_id: 'WEEKDAY', route_id: 'R-01', direction_id: '1', trip_headsign: 'Inbound' },
    { trip_id: 'TRIP_3', service_id: 'WEEKDAY', route_id: 'R-02', direction_id: '0', trip_headsign: 'Shuttle' },
  ];
  result.tables['stop_times.txt'].rows = [
    { trip_id: 'TRIP_1', stop_id: 'STOP_A', stop_sequence: '1', departure_time: '08:10', arrival_time: '08:10' },
    { trip_id: 'TRIP_1', stop_id: 'STOP_B', stop_sequence: '2', arrival_time: '08:40', departure_time: '08:42' },
    { trip_id: 'TRIP_1', stop_id: 'STOP_C', stop_sequence: '3', arrival_time: '09:05' },
    { trip_id: 'TRIP_2', stop_id: 'STOP_C', stop_sequence: '1', departure_time: '09:30', arrival_time: '09:30' },
    { trip_id: 'TRIP_2', stop_id: 'STOP_B', stop_sequence: '2', arrival_time: '09:55', departure_time: '09:57' },
    { trip_id: 'TRIP_2', stop_id: 'STOP_A', stop_sequence: '3', arrival_time: '10:20' },
    { trip_id: 'TRIP_3', stop_id: 'STOP_A', stop_sequence: '1', departure_time: '11:00', arrival_time: '11:00' },
    { trip_id: 'TRIP_3', stop_id: 'STOP_B', stop_sequence: '2', arrival_time: '11:20', departure_time: '11:25' },
  ];
  result.tables['routes.txt'] = {
    name: 'routes.txt',
    rows: [
      { route_id: 'R-01', route_short_name: '01', route_long_name: 'Main Line', route_color: '3366FF', route_text_color: 'FFFFFF' },
      { route_id: 'R-02', route_short_name: '02', route_long_name: 'Branch Line' },
    ],
  };

  const dataset = buildExplorerDataset(result, { filter: { serviceId: 'WEEKDAY' } });

  assert.ok(dataset.routeOptions.length >= 2);
  const mainRoute = dataset.routes['R-01'];
  assert.ok(mainRoute);
  assert.equal(mainRoute.tripCount, 2);
  assert.equal(mainRoute.stopCount, 3);
  const directionZero = mainRoute.directions['0'];
  assert.ok(directionZero);
  assert.equal(directionZero.tripCount, 1);
  assert.deepEqual(directionZero.headsigns, ['Outbound']);
  assert.equal(directionZero.trips.length, 1);
  assert.equal(directionZero.trips[0]?.startTime, '08:10');
  assert.equal(directionZero.trips[0]?.endTime, '09:05');
  assert.equal(directionZero.trips[0]?.durationMinutes, 55);
  assert.equal(directionZero.trips[0]?.stopCount, 3);
  assert.equal(directionZero.trips[0]?.serviceId, 'WEEKDAY');

  const directionOne = mainRoute.directions['1'];
  assert.ok(directionOne);
  assert.equal(directionOne.trips[0]?.startTime, '09:30');
  assert.equal(directionOne.trips[0]?.endTime, '10:20');

  const shuttleRoute = dataset.routes['R-02'];
  assert.ok(shuttleRoute);
  assert.equal(shuttleRoute.tripCount, 1);
  assert.equal(shuttleRoute.stopCount, 2);

  assert.deepEqual(dataset.alerts, []);
});

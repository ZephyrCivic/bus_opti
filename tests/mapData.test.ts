/**
 * tests/mapData.test.ts
 * Unit tests for GTFS → GeoJSON transformation used by Explorer map overlay.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExplorerGeoJson } from '../src/features/explorer/mapData';
import type { GtfsImportResult } from '../src/services/import/gtfsParser';

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

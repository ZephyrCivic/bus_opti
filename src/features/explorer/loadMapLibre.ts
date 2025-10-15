/**
 * src/features/explorer/loadMapLibre.ts
 * Provides a cached dynamic import of MapLibre GL so Explorer assets stay code-split.
 */

type MapLibreModule = typeof import('maplibre-gl');

const defaultImporter = () => import('maplibre-gl');

let activeImporter: () => Promise<MapLibreModule> = defaultImporter;
let cachedPromise: Promise<MapLibreModule> | null = null;

export async function loadMapLibre(): Promise<MapLibreModule> {
  if (!cachedPromise) {
    cachedPromise = activeImporter();
  }
  return cachedPromise;
}

export function setMapLibreImporter(importer: () => Promise<MapLibreModule>): void {
  activeImporter = importer;
  cachedPromise = null;
}

export function restoreMapLibreImporter(): void {
  activeImporter = defaultImporter;
  cachedPromise = null;
}

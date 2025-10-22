import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
export const SAMPLE_GTFS_ZIP = path.join(PROJECT_ROOT, 'data', 'GTFS-JP(gunmachuo).zip');

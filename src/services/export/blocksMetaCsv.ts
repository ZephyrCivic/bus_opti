import type { BlockPlan } from '@/services/blocks/blockBuilder';
import type { BlockMetaEntry } from '@/types';

export interface BlocksMetaCsvExport {
  csv: string;
  fileName: string;
  generatedAt: string;
  rowCount: number;
}

export interface BuildBlocksMetaCsvOptions {
  plan: BlockPlan;
  blockMeta: Record<string, BlockMetaEntry | undefined>;
  generatedAt?: Date;
}

const FILE_NAME_PREFIX = 'blocks_meta';

export function buildBlocksMetaCsv(options: BuildBlocksMetaCsvOptions): BlocksMetaCsvExport {
  const { plan, blockMeta, generatedAt = new Date() } = options;
  const generatedAtIso = generatedAt.toISOString();

  const rows = plan.summaries
    .slice()
    .sort((a, b) => a.blockId.localeCompare(b.blockId, 'ja-JP-u-nu-latn'))
    .map((summary) => {
      const meta = blockMeta[summary.blockId];
      return {
        blockId: summary.blockId,
        vehicleTypeId: meta?.vehicleTypeId ?? '',
        vehicleId: meta?.vehicleId ?? '',
      };
    });

  const header = 'block_id,vehicle_type_id,vehicle_id';
  const csvRows = rows.map((row) =>
    [
      csvEscape(row.blockId),
      csvEscape(row.vehicleTypeId),
      csvEscape(row.vehicleId),
    ].join(','),
  );
  const csv = [header, ...csvRows].join('\n');
  const fileName = `${FILE_NAME_PREFIX}-${formatTimestampForFileName(generatedAtIso)}.csv`;

  return {
    csv,
    fileName,
    generatedAt: generatedAtIso,
    rowCount: rows.length,
  };
}

function csvEscape(value: string): string {
  if (value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  if (value.includes(',') || value.includes('\n')) {
    return `"${value}"`;
  }
  return value;
}

function formatTimestampForFileName(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    return iso.replace(/[^0-9]+/g, '').slice(0, 14) || 'export';
  }
  const [, yyyy, mm, dd, hh, mi, ss] = match;
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

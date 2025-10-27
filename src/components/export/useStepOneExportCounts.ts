import { useMemo } from 'react';

import { buildDutyPlanData } from '@/features/duties/hooks/useDutyPlan';
import { isStepOne } from '@/config/appStep';
import { useGtfsImport } from '@/services/import/GtfsImportProvider';

export interface StepOneExportCounts {
  totalBlocks: number;
  unassignedVehicleBlocks: number;
  totalDuties: number;
  unassignedDrivers: number;
  totalTrips: number;
  unassignedTrips: number;
}

export function useStepOneExportCounts(): StepOneExportCounts {
  const { result, manual, dutyState } = useGtfsImport();
  const duties = dutyState.duties;

  return useMemo(() => {
    if (!isStepOne) {
      return {
        totalBlocks: 0,
        unassignedVehicleBlocks: 0,
        totalDuties: duties.length,
        unassignedDrivers: 0,
        totalTrips: 0,
        unassignedTrips: 0,
      };
    }

    const { plan } = buildDutyPlanData(result, manual);
    const blockMeta = manual.blockMeta ?? {};
    const assignedVehicleBlocks = new Set<string>();
    for (const [blockId, meta] of Object.entries(blockMeta)) {
      if (meta?.vehicleId && meta.vehicleId.trim().length > 0) {
        assignedVehicleBlocks.add(blockId);
      }
    }

    const totalBlocks = plan.summaries.length;
    const unassignedVehicleBlocks = plan.summaries.reduce((acc, summary) => {
      return assignedVehicleBlocks.has(summary.blockId) ? acc : acc + 1;
    }, 0);

    const totalDuties = duties.length;
    const unassignedDrivers = duties.reduce((acc, duty) => {
      if (!duty.driverId || duty.driverId.trim().length === 0) {
        return acc + 1;
      }
      return acc;
    }, 0);

    const totalTrips = plan.totalTripCount;
    const unassignedTrips = plan.unassignedTripIds.length;

    return {
      totalBlocks,
      unassignedVehicleBlocks,
      totalDuties,
      unassignedDrivers,
      totalTrips,
      unassignedTrips,
    };
  }, [result, manual, duties]);
}

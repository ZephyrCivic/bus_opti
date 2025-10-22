import { useCallback, useEffect, useMemo, useState } from 'react';

import type { BlockPlan } from '@/services/blocks/blockBuilder';
import {
  cloneBlockPlan,
  connectBlocksPlan,
  getConnectionCandidates,
  type BlockConnectionCandidate,
  type ManualConnection,
  type ManualPlanConfig,
} from '@/services/blocks/manualPlan';

interface HistoryEntry {
  connection: ManualConnection;
  previousPlan: BlockPlan;
}

export interface UseManualBlocksPlanResult {
  plan: BlockPlan;
  connections: ManualConnection[];
  connect: (fromBlockId: string, toBlockId: string) => boolean;
  undoLastConnection: () => boolean;
  candidatesFor: (blockId: string) => BlockConnectionCandidate[];
}

export function useManualBlocksPlan(initialPlan: BlockPlan, config: ManualPlanConfig): UseManualBlocksPlanResult {
  const [manualPlan, setManualPlan] = useState<BlockPlan>(() => cloneBlockPlan(initialPlan));
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setManualPlan(cloneBlockPlan(initialPlan));
    setHistory([]);
  }, [initialPlan]);

  const connect = useCallback(
    (fromBlockId: string, toBlockId: string) => {
      let succeeded = false;
      setManualPlan((previous) => {
        const result = connectBlocksPlan(previous, fromBlockId, toBlockId, config);
        if (!result) {
          return previous;
        }
        succeeded = true;
        setHistory((current) => [
          ...current,
          {
            connection: result.connection,
            previousPlan: cloneBlockPlan(previous),
          },
        ]);
        return result.plan;
      });
      return succeeded;
    },
    [config],
  );

  const undoLastConnection = useCallback(() => {
    let undone = false;
    setHistory((current) => {
      if (current.length === 0) {
        return current;
      }
      const nextHistory = current.slice(0, -1);
      const last = current[current.length - 1]!;
      setManualPlan(cloneBlockPlan(last.previousPlan));
      undone = true;
      return nextHistory;
    });
    return undone;
  }, []);

  const candidatesFor = useCallback(
    (blockId: string) => getConnectionCandidates(manualPlan, blockId, config),
    [manualPlan, config],
  );

  const connections = useMemo(() => history.map((entry) => entry.connection), [history]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const testWindow = window as typeof window & {
      __TEST_BLOCKS_MANUAL_PLAN?: {
        plan: BlockPlan;
        connections: ManualConnection[];
      };
    };
    testWindow.__TEST_BLOCKS_MANUAL_PLAN = {
      plan: manualPlan,
      connections,
    };
    return () => {
      delete testWindow.__TEST_BLOCKS_MANUAL_PLAN;
    };
  }, [manualPlan, connections]);

  return {
    plan: manualPlan,
    connections,
    connect,
    undoLastConnection,
    candidatesFor,
  };
}

/**
 * src/services/import/GtfsImportProvider.tsx
 * React context for GTFS import state and Duty editing helpers.
 * Keeps GTFS parsing, Duty state transitions, and undo handling available to UI layers.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import {
  addDutySegment,
  createDutyEditState,
  deleteDutySegment,
  moveDutySegment,
  replaceDutyState,
  undoLastAction,
  redoLastAction,
  type AddDutySegmentInput,
  type BlockTripSequenceIndex,
  type DeleteDutySegmentInput,
  type MoveDutySegmentInput,
} from '@/services/duty/dutyState';
import type { Duty, DutyEditState, DutySettings, ManualInputs } from '@/types';
import { autoCorrectDuty } from '@/services/duty/dutyAutoCorrect';
import type { BlockTripLookup } from '@/services/duty/dutyMetrics';
import { loadDutyState, saveDutyState } from '@/services/duty/dutyPersistence';

import { GtfsImportError, type GtfsImportResult, parseGtfsArchive } from './gtfsParser';
import { buildDutyPlanData } from '@/features/duties/hooks/useDutyPlan';

export type GtfsImportStatus = 'idle' | 'parsing' | 'ready' | 'error';

export interface GtfsImportState {
  status: GtfsImportStatus;
  result?: GtfsImportResult;
  errorMessage?: string;
}

export interface DutyEditorActions {
  addSegment: (input: AddDutySegmentInput, index: BlockTripSequenceIndex) => void;
  moveSegment: (input: MoveDutySegmentInput, index: BlockTripSequenceIndex) => void;
  deleteSegment: (input: DeleteDutySegmentInput) => void;
  undo: () => void;
  redo: () => void;
  replace: (duties: Duty[]) => void;
  autoCorrect: (dutyId: string, tripLookup: BlockTripLookup) => boolean;
  reset: () => void;
  updateSettings: (settings: Partial<DutySettings>) => void;
}

interface GtfsImportContextValue extends GtfsImportState {
  dutyState: DutyEditState;
  dutyActions: DutyEditorActions;
  importFromFile: (file: File) => Promise<void>;
  loadFromSaved: (result: GtfsImportResult) => void;
  reset: () => void;
  manual: ManualInputs;
  setManual: (updater: (prev: ManualInputs) => ManualInputs) => void;
  selectedRouteIds: string[];
  setSelectedRouteIds: (next: string[] | ((prev: string[]) => string[])) => void;
}

const GtfsImportContext = createContext<GtfsImportContextValue | undefined>(undefined);

export function GtfsImportProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, setState] = useState<GtfsImportState>({ status: 'idle' });
  const [dutyState, setDutyState] = useState<DutyEditState>(() => {
    const stored = loadDutyState();
    if (!stored) {
      return createDutyEditState();
    }
    const base = createDutyEditState(stored.settings);
    return {
      ...base,
      duties: stored.duties,
    };
  });
  const [manual, setManualState] = useState<ManualInputs>(() => ({
    depots: [],
    reliefPoints: [],
    deadheadRules: [],
    drivers: [],
    laborRules: [],
    vehicleTypes: [],
    vehicles: [],
    blockMeta: {},
    linking: { enabled: true, minTurnaroundMin: 10, maxConnectRadiusM: 100, allowParentStation: true },
  }));
  const [selectedRouteIds, setSelectedRouteIdsState] = useState<string[]>([]);

  const normalizeRouteIds = useCallback((ids: string[]): string[] => {
    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const raw of ids) {
      const candidate = typeof raw === 'string' ? raw.trim() : '';
      if (!candidate) {
        continue;
      }
      if (seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      normalized.push(candidate);
    }
    return normalized;
  }, []);

  const setSelectedRouteIds = useCallback((next: string[] | ((prev: string[]) => string[])) => {
    if (typeof next === 'function') {
      setSelectedRouteIdsState((prev) => normalizeRouteIds(next(prev)));
      return;
    }
    setSelectedRouteIdsState(normalizeRouteIds(next));
  }, [normalizeRouteIds]);

  const resetDutyState = useCallback(() => {
    setDutyState((prev) => createDutyEditState(prev.settings));
  }, []);

  useEffect(() => {
    saveDutyState(dutyState);
  }, [dutyState]);

  const importFromFile = useCallback(async (file: File) => {
    setState({ status: 'parsing' });
    try {
      const result = await parseGtfsArchive(file);
      setState({ status: 'ready', result });
      resetDutyState();
      setSelectedRouteIdsState([]);
    } catch (error) {
      const message = error instanceof GtfsImportError ? error.message : '読み込み中に予期しないエラーが発生しました。';
      setState({ status: 'error', errorMessage: message });
    }
  }, [resetDutyState]);

  const loadFromSaved = useCallback((result: GtfsImportResult) => {
    setState({ status: 'ready', result });
    resetDutyState();
    setSelectedRouteIdsState([]);
  }, [resetDutyState]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
    resetDutyState();
    setManualState((prev) => ({
      ...prev,
      depots: [],
      reliefPoints: [],
      deadheadRules: [],
      drivers: [],
      vehicleTypes: [],
      vehicles: [],
    }));
    setSelectedRouteIdsState([]);
  }, [resetDutyState]);

  const dutyActions = useMemo<DutyEditorActions>(() => ({
    addSegment: (input, index) => {
      setDutyState((prev) => addDutySegment(prev, input, index));
    },
    moveSegment: (input, index) => {
      setDutyState((prev) => moveDutySegment(prev, input, index));
    },
    deleteSegment: (input) => {
      setDutyState((prev) => deleteDutySegment(prev, input));
    },
    undo: () => {
      setDutyState((prev) => undoLastAction(prev));
    },
    redo: () => {
      setDutyState((prev) => redoLastAction(prev));
    },
    replace: (duties: Duty[]) => {
      setDutyState((prev) => replaceDutyState(prev, duties));
    },
    autoCorrect: (dutyId, tripLookup) => {
      let changed = false;
      setDutyState((prev) => {
        const duty = prev.duties.find((entry) => entry.id === dutyId);
        if (!duty) {
          return prev;
        }
        const result = autoCorrectDuty(duty, tripLookup, prev.settings);
        if (!result.changed) {
          return prev;
        }
        changed = true;
        const duties = prev.duties.map((entry) => (entry.id === dutyId ? result.duty : entry));
        return replaceDutyState(prev, duties);
      });
      return changed;
    },
    reset: () => {
      resetDutyState();
    },
    updateSettings: (settings: Partial<DutySettings>) => {
      setDutyState((prev) => ({
        duties: prev.duties,
        settings: { ...prev.settings, ...settings },
        undoStack: prev.undoStack,
        redoStack: prev.redoStack,
      }));
    },
  }), [resetDutyState]);

  const value = useMemo<GtfsImportContextValue>(() => ({
    status: state.status,
    result: state.result,
    errorMessage: state.errorMessage,
    dutyState,
    dutyActions,
    importFromFile,
    loadFromSaved,
    reset,
    manual,
    setManual: (updater) => setManualState((prev) => updater(prev)),
    selectedRouteIds,
    setSelectedRouteIds,
  }), [state, dutyState, dutyActions, importFromFile, loadFromSaved, reset, manual, selectedRouteIds, setSelectedRouteIds]);

  useEffect(() => {
    if (!state.result) {
      setSelectedRouteIdsState([]);
      return;
    }
    const availableRouteIds = extractRouteIds(state.result);
    setSelectedRouteIdsState((prev) => {
      const next = normalizeRouteIds(availableRouteIds);
      const current = normalizeRouteIds(prev);
      if (arraysEqual(current, next)) {
        return prev;
      }
      return next;
    });
  }, [state.result, normalizeRouteIds]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const testWindow = window as typeof window & {
      __TEST_DUTY_ACTIONS?: DutyEditorActions;
    };
    testWindow.__TEST_DUTY_ACTIONS = dutyActions;
  }, [dutyActions]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const testWindow = window as typeof window & {
      __TEST_DUTY_PLAN?: ReturnType<typeof buildDutyPlanData>;
      __TEST_MANUAL_INPUTS?: ManualInputs;
    };
    if (!state.result) {
      delete testWindow.__TEST_DUTY_PLAN;
      return;
    }
    testWindow.__TEST_DUTY_PLAN = buildDutyPlanData(state.result, manual);
  }, [state.result, manual]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const testWindow = window as typeof window & {
      __TEST_MANUAL_INPUTS?: ManualInputs;
    };
    testWindow.__TEST_MANUAL_INPUTS = manual;
    return () => {
      delete (window as typeof window & { __TEST_MANUAL_INPUTS?: ManualInputs }).__TEST_MANUAL_INPUTS;
    };
  }, [manual]);

  return <GtfsImportContext.Provider value={value}>{children}</GtfsImportContext.Provider>;
}

export function useGtfsImport(): GtfsImportContextValue {
  const context = useContext(GtfsImportContext);
  if (!context) {
    throw new Error('useGtfsImport は GtfsImportProvider の内側で使用してください。');
  }
  return context;
}

function extractRouteIds(result: GtfsImportResult): string[] {
  const trips = result.tables['trips.txt']?.rows ?? [];
  const ids = new Set<string>();
  for (const trip of trips) {
    const raw = typeof trip.route_id === 'string' ? trip.route_id.trim() : '';
    if (raw) {
      ids.add(raw);
    }
  }
  return Array.from(ids).sort((a, b) => a.localeCompare(b, 'ja-JP-u-nu-latn'));
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

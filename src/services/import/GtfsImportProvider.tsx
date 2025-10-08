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
    linking: { enabled: true, minTurnaroundMin: 10, maxConnectRadiusM: 100, allowParentStation: true },
  }));

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
    } catch (error) {
      const message = error instanceof GtfsImportError ? error.message : '読み込み中に予期しないエラーが発生しました。';
      setState({ status: 'error', errorMessage: message });
    }
  }, [resetDutyState]);

  const loadFromSaved = useCallback((result: GtfsImportResult) => {
    setState({ status: 'ready', result });
    resetDutyState();
  }, [resetDutyState]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
    resetDutyState();
    setManualState((prev) => ({ ...prev, depots: [], reliefPoints: [], deadheadRules: [], drivers: [] }));
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
  }), [state, dutyState, dutyActions, importFromFile, loadFromSaved, reset, manual]);

  return <GtfsImportContext.Provider value={value}>{children}</GtfsImportContext.Provider>;
}

export function useGtfsImport(): GtfsImportContextValue {
  const context = useContext(GtfsImportContext);
  if (!context) {
    throw new Error('useGtfsImport は GtfsImportProvider の内側で使用してください。');
  }
  return context;
}

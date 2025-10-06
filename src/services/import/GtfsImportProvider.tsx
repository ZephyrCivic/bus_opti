/**
 * src/services/import/GtfsImportProvider.tsx
 * React context for GTFS import state, exposing actions to parse ZIP archives and reset data.
 * Keeps data in-memory so他機能がMVP中に共有できるようにする。
 */
import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { GtfsImportError, type GtfsImportResult, parseGtfsArchive } from './gtfsParser';

export type GtfsImportStatus = 'idle' | 'parsing' | 'ready' | 'error';

export interface GtfsImportState {
  status: GtfsImportStatus;
  result?: GtfsImportResult;
  errorMessage?: string;
}

interface GtfsImportContextValue extends GtfsImportState {
  importFromFile: (file: File) => Promise<void>;
  loadFromSaved: (result: GtfsImportResult) => void;
  reset: () => void;
}

const GtfsImportContext = createContext<GtfsImportContextValue | undefined>(undefined);

export function GtfsImportProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, setState] = useState<GtfsImportState>({ status: 'idle' });

  const importFromFile = useCallback(async (file: File) => {
    setState({ status: 'parsing' });
    try {
      const result = await parseGtfsArchive(file);
      setState({ status: 'ready', result });
    } catch (error) {
      const message = error instanceof GtfsImportError ? error.message : '予期しないエラーが発生しました。';
      setState({ status: 'error', errorMessage: message });
    }
  }, []);

  const loadFromSaved = useCallback((result: GtfsImportResult) => {
    setState({ status: 'ready', result });
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  const value = useMemo<GtfsImportContextValue>(() => ({
    status: state.status,
    result: state.result,
    errorMessage: state.errorMessage,
    importFromFile,
    loadFromSaved,
    reset,
  }), [state, importFromFile, loadFromSaved, reset]);

  return <GtfsImportContext.Provider value={value}>{children}</GtfsImportContext.Provider>;
}

export function useGtfsImport(): GtfsImportContextValue {
  const context = useContext(GtfsImportContext);
  if (!context) {
    throw new Error('useGtfsImport は GtfsImportProvider の内側で使用してください。');
  }
  return context;
}

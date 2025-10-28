import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ExternalDragPayload =
  | {
      type: 'block-trip';
      blockId: string;
      tripId: string;
      serviceDayIndex: number;
      startMinutes: number;
      endMinutes: number;
    }
  | {
      type: 'block-trip-range';
      blockId: string;
      startTripId: string;
      endTripId: string;
      serviceDayIndex: number;
      startMinutes: number;
      endMinutes: number;
    }
  | {
      type: 'duty-segment';
      dutyId: string;
      segmentId: string;
      blockId: string;
      startTripId: string;
      endTripId: string;
    }
  | {
      type: 'break-token';
      durationMinutes: number;
    }
  | {
      type: 'deadhead-token';
      fromStopId?: string;
      toStopId?: string;
      durationMinutes?: number;
    }
  | {
      type: 'unassigned-range';
      blockId: string;
      startTripId: string;
      endTripId: string;
      serviceDayIndex: number;
      startMinutes: number;
      endMinutes: number;
    };

export interface DragPosition {
  clientX: number;
  clientY: number;
}

export interface DragOrigin {
  laneId?: string;
  segmentId?: string;
}

export interface DragSession {
  id: string;
  payload: ExternalDragPayload;
  origin?: DragOrigin;
  pointerId?: number;
  pointerType?: string;
  startedAt: number;
  position?: DragPosition;
}

export interface DragEndResult {
  dropSucceeded: boolean;
  dropLaneId?: string;
  dropMinutes?: number;
}

export type DragBusEvent =
  | { type: 'start'; session: DragSession }
  | { type: 'update'; session: DragSession }
  | { type: 'end'; session: DragSession; result: DragEndResult }
  | { type: 'cancel'; session: DragSession };

export type DragBusListener = (event: DragBusEvent) => void;

export interface DragHoverTarget {
  id: string;
  onDrop: (session: DragSession) => DragEndResult | null;
}

export interface DragBusValue {
  activeSession: DragSession | null;
  beginDrag: (payload: ExternalDragPayload, options?: { origin?: DragOrigin; pointerId?: number; pointerType?: string; initialPosition?: DragPosition }) => void;
  updateDrag: (position: DragPosition) => void;
  endDrag: (result: DragEndResult) => void;
  cancelDrag: () => void;
  subscribe: (listener: DragBusListener) => () => void;
  setHoverTarget: (target: DragHoverTarget | null) => void;
}

const DragBusContext = createContext<DragBusValue | null>(null);

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

export function DragBusProvider({ children }: { children: ReactNode }): JSX.Element {
  const listenersRef = useRef(new Set<DragBusListener>());
  const [session, setSession] = useState<DragSession | null>(null);
  const pointerListenersRef = useRef<{
    pointerId?: number;
    handlePointerMove?: (event: PointerEvent) => void;
    handlePointerUp?: (event: PointerEvent) => void;
  } | null>(null);
  const hoverTargetRef = useRef<DragHoverTarget | null>(null);

  const detachPointerListeners = useCallback(() => {
    const current = pointerListenersRef.current;
    if (!current) {
      return;
    }
    if (typeof window !== 'undefined') {
      if (current.handlePointerMove) {
        window.removeEventListener('pointermove', current.handlePointerMove);
      }
      if (current.handlePointerUp) {
        window.removeEventListener('pointerup', current.handlePointerUp);
        window.removeEventListener('pointercancel', current.handlePointerUp);
      }
    }
    pointerListenersRef.current = null;
  }, []);

  const notify = useCallback((event: DragBusEvent) => {
    for (const listener of listenersRef.current) {
      listener(event);
    }
  }, []);

  const beginDrag = useCallback<DragBusValue['beginDrag']>((payload, options) => {
    const timestamp = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    const nextSession: DragSession = {
      id: generateSessionId(),
      payload,
      origin: options?.origin,
      pointerId: options?.pointerId,
      pointerType: options?.pointerType,
      startedAt: timestamp,
      position: options?.initialPosition,
    };
    setSession(nextSession);
    notify({ type: 'start', session: nextSession });
    hoverTargetRef.current = null;
    if (typeof window !== 'undefined' && options?.pointerId !== undefined) {
      detachPointerListeners();
      const handlePointerMove = (event: PointerEvent) => {
        if (event.pointerId !== options.pointerId) {
          return;
        }
        updateDrag({ clientX: event.clientX, clientY: event.clientY });
      };
      const handlePointerUp = (event: PointerEvent) => {
        if (event.pointerId !== options.pointerId) {
          return;
        }
        detachPointerListeners();
        setSession((current) => {
          if (!current) {
            return current;
          }
          const target = hoverTargetRef.current;
          if (target) {
            const dropResult = target.onDrop(current);
            if (dropResult) {
              notify({ type: 'end', session: current, result: dropResult });
              return null;
            }
          }
          notify({ type: 'cancel', session: current });
          return null;
        });
        hoverTargetRef.current = null;
      };
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp, { once: false });
      window.addEventListener('pointercancel', handlePointerUp, { once: false });
      pointerListenersRef.current = {
        pointerId: options.pointerId,
        handlePointerMove,
        handlePointerUp,
      };
    }
  }, [notify]);

  const updateDrag = useCallback<DragBusValue['updateDrag']>((position) => {
    setSession((current) => {
      if (!current) {
        return current;
      }
      const next = { ...current, position };
      notify({ type: 'update', session: next });
      return next;
    });
  }, [notify]);

  const endDrag = useCallback<DragBusValue['endDrag']>((result) => {
    detachPointerListeners();
    setSession((current) => {
      if (!current) {
        return current;
      }
      notify({ type: 'end', session: current, result });
      return null;
    });
    hoverTargetRef.current = null;
  }, [detachPointerListeners, notify]);

  const cancelDrag = useCallback(() => {
    detachPointerListeners();
    setSession((current) => {
      if (!current) {
        return current;
      }
      notify({ type: 'cancel', session: current });
      return null;
    });
    hoverTargetRef.current = null;
  }, [detachPointerListeners, notify]);

  const subscribe = useCallback<DragBusValue['subscribe']>((listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const setHoverTarget = useCallback<DragBusValue['setHoverTarget']>((target) => {
    hoverTargetRef.current = target;
  }, []);

  const value = useMemo<DragBusValue>(() => ({
    activeSession: session,
    beginDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    subscribe,
    setHoverTarget,
  }), [beginDrag, cancelDrag, endDrag, session, setHoverTarget, subscribe, updateDrag]);

  return <DragBusContext.Provider value={value}>{children}</DragBusContext.Provider>;
}

export function useDragBus(): DragBusValue {
  const context = useContext(DragBusContext);
  if (!context) {
    throw new Error('useDragBus must be used within a DragBusProvider');
  }
  return context;
}

export function useOptionalDragBus(): DragBusValue | null {
  return useContext(DragBusContext);
}

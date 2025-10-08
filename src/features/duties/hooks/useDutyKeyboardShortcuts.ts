/**
 * src/features/duties/hooks/useDutyKeyboardShortcuts.ts
 * Dutyビューでのキーボードショートカット（Undo/Redo と Duty/Segment ナビゲーション）を担当する。
 */
import { useEffect } from 'react';

import type { Duty, DutyEditState, DutySegment } from '@/types';
import type { DutyEditorActions } from '@/services/import/GtfsImportProvider';
import type { SegmentSelection } from './useDutySelectionState';

interface DutyKeyboardParams {
  dutyState: DutyEditState;
  selectedDutyId: string | null;
  selectedSegment: SegmentSelection | null;
  setSelectedDutyId: (id: string | null) => void;
  setSelectedSegment: (selection: SegmentSelection | null) => void;
  setSelectedBlockId: (blockId: string | null) => void;
  setStartTripId: (tripId: string | null) => void;
  setEndTripId: (tripId: string | null) => void;
  dutyActions: DutyEditorActions;
}

export function useDutyKeyboardShortcuts(params: DutyKeyboardParams): void {
  const {
    dutyState,
    selectedDutyId,
    selectedSegment,
    setSelectedDutyId,
    setSelectedSegment,
    setSelectedBlockId,
    setStartTripId,
    setEndTripId,
    dutyActions,
  } = params;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            dutyActions.redo();
          } else {
            dutyActions.undo();
          }
        } else if (key === 'y') {
          event.preventDefault();
          dutyActions.redo();
        }
        return;
      }

      if (event.altKey) {
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        focusAdjacentSegment({
          event,
          dutyState,
          selectedDutyId,
          selectedSegment,
          setSelectedDutyId,
          setSelectedSegment,
          setSelectedBlockId,
          setStartTripId,
          setEndTripId,
        });
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        focusAdjacentDuty({
          event,
          dutyState,
          selectedDutyId,
          setSelectedDutyId,
          setSelectedSegment,
          setSelectedBlockId,
          setStartTripId,
          setEndTripId,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    dutyActions,
    dutyState,
    selectedDutyId,
    selectedSegment,
    setSelectedBlockId,
    setSelectedDutyId,
    setSelectedSegment,
    setStartTripId,
    setEndTripId,
  ]);
}

interface SegmentFocusParams {
  event: KeyboardEvent;
  dutyState: DutyEditState;
  selectedDutyId: string | null;
  selectedSegment: SegmentSelection | null;
  setSelectedDutyId: (id: string | null) => void;
  setSelectedSegment: (selection: SegmentSelection | null) => void;
  setSelectedBlockId: (blockId: string | null) => void;
  setStartTripId: (tripId: string | null) => void;
  setEndTripId: (tripId: string | null) => void;
}

function focusAdjacentSegment(params: SegmentFocusParams): void {
  const {
    event,
    dutyState,
    selectedDutyId,
    selectedSegment,
    setSelectedDutyId,
    setSelectedSegment,
    setSelectedBlockId,
    setStartTripId,
    setEndTripId,
  } = params;

  if (!selectedDutyId) {
    return;
  }
  const dutyIndex = dutyState.duties.findIndex((entry) => entry.id === selectedDutyId);
  if (dutyIndex === -1) {
    return;
  }
  const duty = dutyState.duties[dutyIndex];
  if (duty.segments.length === 0) {
    return;
  }
  const orderedSegments = [...duty.segments].sort((a, b) => a.startTripId.localeCompare(b.startTripId));
  const currentIndex = selectedSegment
    ? orderedSegments.findIndex((segment) => segment.id === selectedSegment.segmentId)
    : -1;
  const direction = event.key === 'ArrowLeft' ? -1 : 1;
  let nextSegment: DutySegment | null = null;
  let nextDutyId = selectedDutyId;
  let nextDutyIndex = dutyIndex;

  if (currentIndex === -1) {
    nextSegment = orderedSegments[direction === 1 ? 0 : orderedSegments.length - 1];
  } else {
    const candidateIndex = currentIndex + direction;
    if (candidateIndex >= 0 && candidateIndex < orderedSegments.length) {
      nextSegment = orderedSegments[candidateIndex];
    } else {
      nextDutyIndex = dutyIndex + direction;
      if (nextDutyIndex >= 0 && nextDutyIndex < dutyState.duties.length) {
        const neighbour = dutyState.duties[nextDutyIndex];
        if (neighbour.segments.length > 0) {
          const neighbourSegments = [...neighbour.segments].sort((a, b) => a.startTripId.localeCompare(b.startTripId));
          nextSegment = direction === 1 ? neighbourSegments[0] : neighbourSegments[neighbourSegments.length - 1];
          nextDutyId = neighbour.id;
        }
      }
    }
  }

  if (nextSegment) {
    event.preventDefault();
    setSelectedDutyId(nextDutyId);
    setSelectedSegment({ dutyId: nextDutyId, segmentId: nextSegment.id });
    setSelectedBlockId(nextSegment.blockId);
    setStartTripId(nextSegment.startTripId);
    setEndTripId(nextSegment.endTripId);
  }
}

interface DutyFocusParams {
  event: KeyboardEvent;
  dutyState: DutyEditState;
  selectedDutyId: string | null;
  setSelectedDutyId: (id: string | null) => void;
  setSelectedSegment: (selection: SegmentSelection | null) => void;
  setSelectedBlockId: (blockId: string | null) => void;
  setStartTripId: (tripId: string | null) => void;
  setEndTripId: (tripId: string | null) => void;
}

function focusAdjacentDuty(params: DutyFocusParams): void {
  const {
    event,
    dutyState,
    selectedDutyId,
    setSelectedDutyId,
    setSelectedSegment,
    setSelectedBlockId,
    setStartTripId,
    setEndTripId,
  } = params;

  if (dutyState.duties.length === 0) {
    return;
  }
  const direction = event.key === 'ArrowUp' ? -1 : 1;
  let index = selectedDutyId
    ? dutyState.duties.findIndex((entry) => entry.id === selectedDutyId)
    : -1;
  index = index === -1 ? (direction === 1 ? 0 : dutyState.duties.length - 1) : index + direction;
  if (index >= 0 && index < dutyState.duties.length) {
    const duty = dutyState.duties[index];
    event.preventDefault();
    setSelectedDutyId(duty.id);
    if (duty.segments.length > 0) {
      const orderedSegments = [...duty.segments].sort((a, b) => a.startTripId.localeCompare(b.startTripId));
      const segment = orderedSegments[direction === 1 ? 0 : orderedSegments.length - 1];
      setSelectedSegment({ dutyId: duty.id, segmentId: segment.id });
      setSelectedBlockId(segment.blockId);
      setStartTripId(segment.startTripId);
      setEndTripId(segment.endTripId);
    } else {
      setSelectedSegment(null);
      setStartTripId(null);
      setEndTripId(null);
    }
  }
}

/**
 * src/features/timeline/types.ts
 * TimelineGantt が消費するデータモデルを定義し、Blocks/Duties 双方で共通利用する。
 */
import type { ExternalDragPayload } from './dragBus';

export interface TimelineSegment<Meta = unknown> {
  id: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  color?: string;
  meta?: Meta;
}

export interface TimelineLane<SegmentMeta = unknown> {
  id: string;
  label: string;
  segments: TimelineSegment<SegmentMeta>[];
  tag?: TimelineLaneTag;
}

export interface TimelineSelection<Meta = unknown> {
  laneId: string;
  segmentId?: string;
  segment?: TimelineSegment<Meta>;
}

export type TimelineInteractionEvent =
  | {
      type: 'zoom';
      delta: number;
    }
  | {
      type: 'pan';
      delta: number;
    };

export type TimelineSegmentDragMode = 'move' | 'resize-start' | 'resize-end';

export interface TimelineSegmentDragEvent<Meta = unknown> {
  mode: TimelineSegmentDragMode;
  deltaMinutes: number;
  laneId: string;
  segment: TimelineSegment<Meta>;
  originalStartMinutes: number;
  originalEndMinutes: number;
}

export interface TimelineLaneTag {
  label: string;
  title?: string;
}

export interface TimelineExternalDragOverEvent<Meta = unknown> {
  laneId: string | null;
  minutes: number | null;
  payload: ExternalDragPayload;
  segment?: TimelineSegment<Meta> | null;
  isNewLane: boolean;
}

export interface TimelineExternalDropEvent<Meta = unknown> {
  laneId: string;
  minutes: number;
  payload: ExternalDragPayload;
  segment?: TimelineSegment<Meta> | null;
  isNewLane: boolean;
}

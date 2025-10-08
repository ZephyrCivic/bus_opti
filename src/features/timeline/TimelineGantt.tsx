/**
 * src/features/timeline/TimelineGantt.tsx
 * Blocks/Duties で共通利用する最小限のSVGガント描画コンポーネント。
 */
import { Fragment, useMemo, useRef, useCallback, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import clsx from 'clsx';

import type {
  TimelineInteractionEvent,
  TimelineLane,
  TimelineSegment,
  TimelineSegmentDragEvent,
  TimelineSegmentDragMode,
  TimelineSelection,
} from './types';
import {
  DEFAULT_PIXELS_PER_MINUTE,
  computeTimelineBounds,
  formatMinutesAsTime,
  generateTicks,
  minutesToPosition,
} from './timeScale';

const LANE_HEIGHT = 44;
const AXIS_HEIGHT = 32;
const LABEL_COLUMN_WIDTH = 156;
const MIN_TIMELINE_WIDTH = 720;
const HANDLE_WIDTH = 8;
const PREVIEW_MIN_WIDTH = 2;

interface SegmentDragState<Meta = unknown> {
  pointerId: number;
  mode: TimelineSegmentDragMode;
  laneId: string;
  segment: TimelineSegment<Meta>;
  originClientX: number;
  lastDeltaMinutes: number;
  moved: boolean;
  originalStartMinutes: number;
  originalEndMinutes: number;
}

interface TimelineGanttProps<Meta = unknown> {
  lanes: TimelineLane<Meta>[];
  selectedLaneId?: string | null;
  selectedSegmentId?: string | null;
  onSelect?(selection: TimelineSelection<Meta>): void;
  emptyMessage?: string;
  className?: string;
  pixelsPerMinute?: number;
  onInteraction?(event: TimelineInteractionEvent): void;
  onSegmentDrag?(event: TimelineSegmentDragEvent<Meta>): void;
}

export default function TimelineGantt<Meta>(props: TimelineGanttProps<Meta>): JSX.Element {
  const {
    lanes,
    selectedLaneId,
    selectedSegmentId,
    onSelect,
    emptyMessage = 'タイムラインに表示できるデータがありません。',
    className,
    pixelsPerMinute = DEFAULT_PIXELS_PER_MINUTE,
    onInteraction,
    onSegmentDrag,
  } = props;

  const nonEmptyLanes = useMemo(
    () => lanes.filter((lane) => lane.segments.length > 0),
    [lanes],
  );

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<SegmentDragState<Meta> | null>(null);
  const [previewRect, setPreviewRect] = useState<{
    laneId: string;
    segmentId: string;
    startX: number;
    endX: number;
  } | null>(null);

  const bounds = useMemo(
    () => computeTimelineBounds(nonEmptyLanes),
    [nonEmptyLanes],
  );

  const timelineWidth = useMemo(() => {
    const range = bounds.endMinutes - bounds.startMinutes;
    const width = Math.max(range * pixelsPerMinute, MIN_TIMELINE_WIDTH);
    return Number.isFinite(width) ? width : MIN_TIMELINE_WIDTH;
  }, [bounds.endMinutes, bounds.startMinutes, pixelsPerMinute]);

  const ticks = useMemo(
    () => generateTicks(bounds, pixelsPerMinute, 60),
    [bounds, pixelsPerMinute],
  );

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (event.shiftKey) {
        event.preventDefault();
        onInteraction?.({ type: 'zoom', delta: event.deltaY });
        return;
      }
      if (event.altKey) {
        event.preventDefault();
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollLeft += event.deltaY;
        }
        onInteraction?.({ type: 'pan', delta: event.deltaY });
      }
    },
    [onInteraction],
  );

  const updatePreviewRect = useCallback(
    (drag: SegmentDragState<Meta>, deltaMinutes: number) => {
      let nextStart = drag.originalStartMinutes;
      let nextEnd = drag.originalEndMinutes;
      if (drag.mode === 'move') {
        nextStart += deltaMinutes;
        nextEnd += deltaMinutes;
      } else if (drag.mode === 'resize-start') {
        nextStart += deltaMinutes;
      } else if (drag.mode === 'resize-end') {
        nextEnd += deltaMinutes;
      }
      if (nextEnd < nextStart) {
        const midpoint = (nextStart + nextEnd) / 2;
        nextStart = midpoint;
        nextEnd = midpoint;
      }
      const startX = minutesToPosition(nextStart, bounds, pixelsPerMinute);
      const endX = minutesToPosition(nextEnd, bounds, pixelsPerMinute);
      const minWidth = PREVIEW_MIN_WIDTH;
      const clampedEnd = endX <= startX ? startX + minWidth : endX;
      setPreviewRect({
        laneId: drag.laneId,
        segmentId: drag.segment.id,
        startX,
        endX: clampedEnd,
      });
    },
    [bounds, pixelsPerMinute],
  );

  const beginSegmentDrag = useCallback(
    (
      event: ReactPointerEvent<SVGElement>,
      mode: TimelineSegmentDragMode,
      laneId: string,
      segment: TimelineSegment<Meta>,
    ) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        pointerId: event.pointerId,
        mode,
        laneId,
        segment,
        originClientX: event.clientX,
        lastDeltaMinutes: 0,
        moved: false,
        originalStartMinutes: segment.startMinutes,
        originalEndMinutes: segment.endMinutes,
      };
      updatePreviewRect(dragStateRef.current, 0);
    },
    [updatePreviewRect],
  );

  const updateSegmentDrag = useCallback(
    (event: ReactPointerEvent<SVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const deltaMinutes = (event.clientX - drag.originClientX) / pixelsPerMinute;
      drag.lastDeltaMinutes = deltaMinutes;
      if (!drag.moved && Math.abs(deltaMinutes) > 0.15) {
        drag.moved = true;
      }
      updatePreviewRect(drag, deltaMinutes);
    },
    [pixelsPerMinute, updatePreviewRect],
  );

  const endSegmentDrag = useCallback(
    (event: ReactPointerEvent<SVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (drag.moved && onSegmentDrag) {
        onSegmentDrag({
          mode: drag.mode,
          deltaMinutes: drag.lastDeltaMinutes,
          laneId: drag.laneId,
          segment: drag.segment,
          originalStartMinutes: drag.originalStartMinutes,
          originalEndMinutes: drag.originalEndMinutes,
        });
      }
      dragStateRef.current = null;
      setPreviewRect(null);
    },
    [onSegmentDrag],
  );

  if (nonEmptyLanes.length === 0) {
    return (
      <div className={clsx('rounded-md border border-dashed border-muted-foreground/40 p-6 text-sm text-muted-foreground', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={clsx('flex rounded-md border border-border/80 bg-card', className)}>
      <div
        className="flex flex-col border-r border-border/60"
        style={{ minWidth: LABEL_COLUMN_WIDTH, width: LABEL_COLUMN_WIDTH }}
      >
        <div className="h-[32px] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lane
        </div>
        {nonEmptyLanes.map((lane) => (
          <div
            key={lane.id}
            className={clsx(
              'flex items-center border-t border-border/50 px-3 text-sm',
              selectedLaneId === lane.id ? 'bg-muted/40 font-medium text-foreground' : 'text-muted-foreground',
            )}
            style={{ height: `${LANE_HEIGHT}px` }}
          >
            {lane.label}
          </div>
        ))}
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto"
        onWheel={handleWheel}
      >
        <div style={{ width: timelineWidth }}>
          <svg width={timelineWidth} height={AXIS_HEIGHT} role="presentation">
            <line
              x1={0}
              y1={AXIS_HEIGHT - 1}
              x2={timelineWidth}
              y2={AXIS_HEIGHT - 1}
              stroke="var(--border)"
              strokeWidth="1"
            />
            {ticks.map((tick) => (
              <Fragment key={tick.minutes}>
                <line
                  x1={tick.position}
                  y1={AXIS_HEIGHT - 16}
                  x2={tick.position}
                  y2={AXIS_HEIGHT - 1}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
                <text
                  x={tick.position + 2}
                  y={AXIS_HEIGHT - 20}
                  fontSize="10"
                  fill="var(--muted-foreground)"
                >
                  {tick.label}
                </text>
              </Fragment>
            ))}
          </svg>
          <div className="space-y-[6px] pb-4 pt-1">
            {nonEmptyLanes.map((lane, index) => (
              <svg
                key={lane.id}
                width={timelineWidth}
                height={LANE_HEIGHT}
                role="group"
                aria-label={lane.label}
              >
                <rect
                  x={0}
                  y={0}
                  width={timelineWidth}
                  height={LANE_HEIGHT}
                  fill={selectedLaneId === lane.id ? 'var(--muted)' : 'transparent'}
                />
                {lane.segments.map((segment) => {
                  const startX = minutesToPosition(segment.startMinutes, bounds, pixelsPerMinute);
                  const endX = minutesToPosition(segment.endMinutes, bounds, pixelsPerMinute);
                  const width = Math.max(endX - startX, 2);
                  const isSelected = selectedLaneId === lane.id && selectedSegmentId === segment.id;
                  const moveHandlers = {
                    onPointerDown: (event: ReactPointerEvent<SVGElement>) =>
                      beginSegmentDrag(event, 'move', lane.id, segment),
                    onPointerMove: updateSegmentDrag,
                    onPointerUp: endSegmentDrag,
                    onPointerCancel: endSegmentDrag,
                  };
                  const resizeStartHandlers = {
                    onPointerDown: (event: ReactPointerEvent<SVGElement>) =>
                      beginSegmentDrag(event, 'resize-start', lane.id, segment),
                    onPointerMove: updateSegmentDrag,
                    onPointerUp: endSegmentDrag,
                    onPointerCancel: endSegmentDrag,
                  };
                  const resizeEndHandlers = {
                    onPointerDown: (event: ReactPointerEvent<SVGElement>) =>
                      beginSegmentDrag(event, 'resize-end', lane.id, segment),
                    onPointerMove: updateSegmentDrag,
                    onPointerUp: endSegmentDrag,
                    onPointerCancel: endSegmentDrag,
                  };
                  const leftHandleX = Math.max(startX - HANDLE_WIDTH / 2, 0);
                  const rightHandleX = Math.min(startX + width - HANDLE_WIDTH / 2, timelineWidth - HANDLE_WIDTH);
                  return (
                    <g
                      key={segment.id}
                      className="cursor-pointer"
                      onClick={() => onSelect?.({ laneId: lane.id, segmentId: segment.id, segment })}
                    >
                      <rect
                        x={startX}
                        y={10}
                        width={width}
                        height={LANE_HEIGHT - 20}
                        fill={segment.color ?? 'var(--primary)'}
                        fillOpacity={isSelected ? 0.85 : 0.6}
                        stroke={isSelected ? 'var(--primary)' : 'var(--primary-foreground)'}
                        strokeWidth={isSelected ? 2 : 1}
                        rx={4}
                        ry={4}
                        className="cursor-grab"
                        {...moveHandlers}
                      >
                        <title>
                          {segment.label}
                          {' '}
                          {formatMinutesAsTime(segment.startMinutes)}
                          {' - '}
                          {formatMinutesAsTime(segment.endMinutes)}
                        </title>
                      </rect>
                      {previewRect && previewRect.laneId === lane.id && previewRect.segmentId === segment.id && (
                        <rect
                          x={previewRect.startX}
                          y={10}
                          width={Math.max(previewRect.endX - previewRect.startX, PREVIEW_MIN_WIDTH)}
                          height={LANE_HEIGHT - 20}
                          fill="var(--primary)"
                          fillOpacity={0.25}
                          stroke="var(--primary)"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          pointerEvents="none"
                        />
                      )}
                      <rect
                        x={leftHandleX}
                        y={12}
                        width={HANDLE_WIDTH}
                        height={LANE_HEIGHT - 24}
                        fill="var(--card)"
                        stroke="var(--primary-foreground)"
                        strokeWidth="1"
                        className="cursor-ew-resize"
                        {...resizeStartHandlers}
                      />
                      <rect
                        x={rightHandleX}
                        y={12}
                        width={HANDLE_WIDTH}
                        height={LANE_HEIGHT - 24}
                        fill="var(--card)"
                        stroke="var(--primary-foreground)"
                        strokeWidth="1"
                        className="cursor-ew-resize"
                        {...resizeEndHandlers}
                      />
                      <text
                        x={startX + 6}
                        y={LANE_HEIGHT / 2 + 4}
                        fontSize="10"
                        fill="var(--card-foreground)"
                        pointerEvents="none"
                      >
                        {segment.label}
                      </text>
                    </g>
                  );
                })}
                <line
                  x1={0}
                  y1={LANE_HEIGHT - 1}
                  x2={timelineWidth}
                  y2={LANE_HEIGHT - 1}
                  stroke="var(--border)"
                  strokeWidth={index === nonEmptyLanes.length - 1 ? 0 : 1}
                />
              </svg>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * src/features/timeline/TimelineGantt.tsx
 * Blocks/Duties で共通利用する最小限のSVGガント描画コンポーネント。
 */
import { Fragment, useMemo, useRef, useCallback, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type {
  PointerEvent as ReactPointerEvent,
  UIEvent as ReactUIEvent,
  WheelEvent as ReactWheelEvent,
  MouseEvent as ReactMouseEvent,
  HTMLAttributes,
  CSSProperties,
  SVGProps,
  MutableRefObject,
} from 'react';
import clsx from 'clsx';

import type {
  TimelineInteractionEvent,
  TimelineLane,
  TimelineSegment,
  TimelineSegmentDragEvent,
  TimelineSegmentDragMode,
  TimelineSelection,
  TimelineExternalDragOverEvent,
  TimelineExternalDropEvent,
} from './types';
import {
  DEFAULT_PIXELS_PER_MINUTE,
  computeTimelineBounds,
  formatMinutesAsTime,
  generateTicks,
  minutesToPosition,
  type TimelineBounds,
} from './timeScale';
import { useOptionalDragBus, type DragHoverTarget, type DragSession, type DragEndResult, type DragPosition } from './dragBus';

export const TIMELINE_NEW_LANE_ID = '__new-duty__';

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

export interface TimelineLaneProps<Meta = unknown> {
  labelProps?: HTMLAttributes<HTMLDivElement>;
  trackProps?: HTMLAttributes<HTMLDivElement>;
}

export interface TimelineSegmentContextMenuEvent<Meta = unknown> {
  laneId: string;
  segment: TimelineSegment<Meta>;
  clientX: number;
  clientY: number;
}

export interface TimelineLaneContextMenuEvent {
  laneId: string;
  minutes: number;
  clientX: number;
  clientY: number;
}

export interface TimelineExternalPreviewContext<Meta = unknown> {
  lane: TimelineLane<Meta> | null;
  laneId: string;
  minutes: number | null;
  segment: TimelineSegment<Meta> | null;
  session: DragSession;
  bounds: TimelineBounds;
  pixelsPerMinute: number;
  timelineWidth: number;
  isNewLane: boolean;
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
  scrollLeft?: number;
  onScrollLeftChange?(offset: number): void;
  getLaneProps?(lane: TimelineLane<Meta>): TimelineLaneProps<Meta>;
  onSegmentContextMenu?(event: TimelineSegmentContextMenuEvent<Meta>): void;
  onLaneContextMenu?(event: TimelineLaneContextMenuEvent): void;
  getSegmentProps?(lane: TimelineLane<Meta>, segment: TimelineSegment<Meta>): SVGProps<SVGGElement>;
  enableInternalSegmentDrag?: boolean;
  onExternalDragOver?(event: TimelineExternalDragOverEvent<Meta>): void;
  onExternalDrop?(event: TimelineExternalDropEvent<Meta>): boolean | void;
  renderExternalPreview?(context: TimelineExternalPreviewContext<Meta>): ReactNode;
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
    scrollLeft,
    onScrollLeftChange,
    getLaneProps,
    onSegmentContextMenu,
    onLaneContextMenu,
    getSegmentProps,
    enableInternalSegmentDrag = true,
    onExternalDragOver,
    onExternalDrop,
    renderExternalPreview,
  } = props;

  const dragBus = useOptionalDragBus();
  const activeSession = dragBus?.activeSession ?? null;
  const isExternalDragActive = Boolean(activeSession);

  const composeHandlers = useCallback(<T extends (...args: any[]) => void>(
    primary?: T,
    secondary?: T,
  ): T | undefined => {
    if (!primary) {
      return secondary;
    }
    if (!secondary) {
      return primary;
    }
    const composed = ((event: Parameters<T>[0], ...rest: unknown[]) => {
      secondary(event as never, ...(rest as never[]));
      if ((event as unknown as { defaultPrevented?: boolean }).defaultPrevented) {
        return;
      }
      primary(event as never, ...(rest as never[]));
    }) as T;
    return composed;
  }, []);

  const nonEmptyLanes = useMemo(
    () => lanes.filter((lane) => lane.segments.length > 0),
    [lanes],
  );

  const lanePropsMap = useMemo(() => {
    if (!getLaneProps) {
      return null;
    }
    const map = new Map<string, TimelineLaneProps<Meta>>();
    for (const lane of nonEmptyLanes) {
      map.set(lane.id, getLaneProps(lane));
    }
    return map;
  }, [getLaneProps, nonEmptyLanes]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const laneRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const dragStateRef = useRef<SegmentDragState<Meta> | null>(null);
  const [previewRect, setPreviewRect] = useState<{
    laneId: string;
    segmentId: string;
    startX: number;
    endX: number;
  } | null>(null);
  const [externalHover, setExternalHover] = useState<{
    sessionId: string;
    laneId: string | null;
    minutes: number | null;
    segment: TimelineSegment<Meta> | null;
    isNewLane: boolean;
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

  useEffect(() => {
    if (scrollLeft === undefined) {
      return;
    }
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    if (Math.abs(container.scrollLeft - scrollLeft) > 1) {
      container.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  const findLaneById = useCallback(
    (laneId: string): TimelineLane<Meta> | undefined => nonEmptyLanes.find((lane) => lane.id === laneId),
    [nonEmptyLanes],
  );

  const findLaneAtPosition = useCallback(
    (clientY: number): string | null => {
      for (const [laneId, element] of laneRefs.current.entries()) {
        if (!element) {
          continue;
        }
        const rect = element.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          return laneId;
        }
      }
      return null;
    },
    [],
  );

  const resolveExternalCandidate = useCallback(
    (session: DragSession): {
      sessionId: string;
      laneId: string | null;
      minutes: number | null;
      segment: TimelineSegment<Meta> | null;
      isNewLane: boolean;
    } | null => {
      const position: DragPosition | undefined = session.position;
      const container = scrollContainerRef.current;
      if (!position || !container) {
        return null;
      }
      const rect = container.getBoundingClientRect();
      const withinHorizontal = position.clientX >= rect.left && position.clientX <= rect.right;
      const withinVertical = position.clientY >= rect.top && position.clientY <= rect.bottom;
      if (!withinHorizontal || !withinVertical) {
        return {
          sessionId: session.id,
          laneId: null,
          minutes: null,
          segment: null,
          isNewLane: false,
        };
      }

      const detectedLaneId = findLaneAtPosition(position.clientY);
      const effectiveLaneId = detectedLaneId ?? TIMELINE_NEW_LANE_ID;
      const relativeX = position.clientX - rect.left + container.scrollLeft;
      const minutes = bounds.startMinutes + relativeX / pixelsPerMinute;
      const lane = detectedLaneId ? findLaneById(detectedLaneId) : undefined;
      let targetSegment: TimelineSegment<Meta> | null = null;
      if (lane) {
        targetSegment = lane.segments.find((segment) => {
          return minutes >= segment.startMinutes && minutes <= segment.endMinutes;
        }) ?? null;
      }

        return {
          sessionId: session.id,
          laneId: effectiveLaneId,
          minutes,
          segment: targetSegment,
          isNewLane: !detectedLaneId,
        };
    },
    [bounds.startMinutes, findLaneAtPosition, findLaneById, pixelsPerMinute],
  );

  const handleExternalDrop = useCallback(
    (
      session: DragSession,
      candidate: { laneId: string; minutes: number; segment: TimelineSegment<Meta> | null; isNewLane: boolean },
    ): DragEndResult | null => {
      if (!onExternalDrop) {
        return null;
      }
      const dropEvent: TimelineExternalDropEvent<Meta> = {
        laneId: candidate.laneId,
        minutes: candidate.minutes,
        payload: session.payload,
        segment: candidate.segment ?? undefined,
        isNewLane: candidate.isNewLane,
      };
      const result = onExternalDrop(dropEvent);
      if (result === false) {
        return null;
      }
      return {
        dropSucceeded: true,
        dropLaneId: candidate.laneId,
        dropMinutes: candidate.minutes,
      };
    },
    [onExternalDrop],
  );

  useEffect(() => {
    if (!dragBus) {
      return;
    }
    const unsubscribe = dragBus.subscribe((event) => {
        if (event.type === 'start') {
          setExternalHover({ sessionId: event.session.id, laneId: null, minutes: null, segment: null, isNewLane: false });
          dragBus.setHoverTarget(null);
          if (onExternalDragOver) {
            onExternalDragOver({ laneId: null, minutes: null, payload: event.session.payload, segment: null, isNewLane: false });
          }
        return;
      }
      if (event.type === 'update') {
        const candidate = resolveExternalCandidate(event.session);
        setExternalHover(candidate);
        if (candidate && candidate.laneId && candidate.minutes !== null) {
            const hoverTarget: DragHoverTarget = {
              id: `timeline-drop-${candidate.laneId}`,
              onDrop: (session) => handleExternalDrop(session, {
                laneId: candidate.laneId!,
                minutes: candidate.minutes!,
                segment: candidate.segment ?? null,
                isNewLane: candidate.isNewLane,
              }),
            };
          dragBus.setHoverTarget(hoverTarget);
          if (onExternalDragOver) {
            onExternalDragOver({
              laneId: candidate.laneId,
              minutes: candidate.minutes,
              payload: event.session.payload,
              segment: candidate.segment ?? undefined,
              isNewLane: candidate.isNewLane,
            });
          }
        } else {
          dragBus.setHoverTarget(null);
          if (onExternalDragOver) {
            onExternalDragOver({ laneId: null, minutes: null, payload: event.session.payload, segment: null, isNewLane: false });
          }
        }
        return;
      }
      if (event.type === 'cancel') {
        setExternalHover(null);
        dragBus.setHoverTarget(null);
        if (onExternalDragOver) {
          onExternalDragOver({ laneId: null, minutes: null, payload: event.session.payload, segment: null, isNewLane: false });
        }
        return;
      }
      if (event.type === 'end') {
        setExternalHover(null);
        dragBus.setHoverTarget(null);
      }
    });
    return unsubscribe;
  }, [dragBus, handleExternalDrop, onExternalDragOver, resolveExternalCandidate]);

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
          onScrollLeftChange?.(container.scrollLeft);
        }
        onInteraction?.({ type: 'pan', delta: event.deltaY });
      }
    },
    [onInteraction, onScrollLeftChange],
  );

  const handleScroll = useCallback(
    (event: ReactUIEvent<HTMLDivElement>) => {
      onScrollLeftChange?.(event.currentTarget.scrollLeft);
    },
    [onScrollLeftChange],
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
        {nonEmptyLanes.map((lane) => {
          const laneProps = lanePropsMap?.get(lane.id);
          const { className: labelClassName, style: labelStyleOverride, ...labelRest } =
            laneProps?.labelProps ?? {};
          const labelStyle: CSSProperties = { height: `${LANE_HEIGHT}px`, ...(labelStyleOverride ?? {}) };
          return (
            <div
              key={lane.id}
              className={clsx(
                'flex items-center border-t border-border/50 px-3 text-sm',
                selectedLaneId === lane.id ? 'bg-muted/40 font-medium text-foreground' : 'text-muted-foreground',
                labelClassName,
              )}
              style={labelStyle}
              {...labelRest}
            >
              <div className="flex w-full items-center gap-2">
                <span className="truncate">{lane.label}</span>
                {lane.tag ? (
                  <span
                    className="whitespace-nowrap rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    data-lane-tag={lane.tag.label}
                    title={lane.tag.title ?? lane.tag.label}
                  >
                    {lane.tag.label}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto"
        onWheel={handleWheel}
        onScroll={handleScroll}
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
            {nonEmptyLanes.map((lane, index) => {
              const laneProps = lanePropsMap?.get(lane.id);
              const { className: trackClassName, style: trackStyleOverride, ref: trackCustomRef, ...trackRest } =
                laneProps?.trackProps ?? {};
              const trackStyle: CSSProperties = trackStyleOverride ?? {};
              const isExternalHover = externalHover?.laneId === lane.id;
              const dropPreview = renderExternalPreview && activeSession && isExternalHover
                ? renderExternalPreview({
                    lane,
                    laneId: lane.id,
                    minutes: externalHover?.minutes ?? null,
                    segment: externalHover?.segment ?? null,
                    session: activeSession,
                    bounds,
                    pixelsPerMinute,
                    timelineWidth,
                    isNewLane: Boolean(externalHover?.isNewLane),
                  })
                : null;
              const assignLaneRef = (element: HTMLDivElement | null) => {
                if (element) {
                  laneRefs.current.set(lane.id, element);
                } else {
                  laneRefs.current.delete(lane.id);
                }
                if (!trackCustomRef) {
                  return;
                }
                if (typeof trackCustomRef === 'function') {
                  (trackCustomRef as (instance: HTMLDivElement | null) => void)(element);
                } else if (typeof trackCustomRef === 'object') {
                  (trackCustomRef as MutableRefObject<HTMLDivElement | null>).current = element;
                }
              };
              const handleLaneContextMenuEvent = (event: ReactMouseEvent<SVGSVGElement>) => {
                if (!onLaneContextMenu) {
                  return;
                }
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                const relativeX = event.clientX - rect.left;
                const minutes = bounds.startMinutes + relativeX / pixelsPerMinute;
                onLaneContextMenu({
                  laneId: lane.id,
                  minutes,
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
              };
              return (
                <div
                  key={lane.id}
                  ref={assignLaneRef}
                  className={clsx(
                    'relative',
                    trackClassName,
                    isExternalHover ? 'ring-2 ring-primary/50 ring-inset' : undefined,
                  )}
                  style={trackStyle}
                  {...trackRest}
                >
                  <svg
                    width={timelineWidth}
                    height={LANE_HEIGHT}
                    role="group"
                    aria-label={lane.label}
                    onContextMenu={handleLaneContextMenuEvent}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={timelineWidth}
                      height={LANE_HEIGHT}
                      fill={selectedLaneId === lane.id ? 'var(--muted)' : 'transparent'}
                    />
                    {lane.segments.map((segment) => {
                      const segmentCustomProps = getSegmentProps?.(lane, segment) ?? {};
                      const {
                        className: customSegmentClassName,
                        onClick: customOnClick,
                        onContextMenu: customOnContextMenu,
                        onPointerDown: customOnPointerDown,
                        onPointerMove: customOnPointerMove,
                        onPointerUp: customOnPointerUp,
                        onPointerCancel: customOnPointerCancel,
                        ...restSegmentProps
                      } = segmentCustomProps;
                      const segmentClassName = clsx('cursor-pointer', customSegmentClassName);
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
                      const handleSegmentContextMenuEvent = (event: ReactMouseEvent<SVGElement>) => {
                        if (!onSegmentContextMenu) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        onSegmentContextMenu({
                          laneId: lane.id,
                          segment,
                          clientX: event.clientX,
                          clientY: event.clientY,
                        });
                      };
                      return (
                        <g
                          key={segment.id}
                          className={segmentClassName}
                          onClick={composeHandlers(() => onSelect?.({ laneId: lane.id, segmentId: segment.id, segment }), customOnClick)}
                          onContextMenu={composeHandlers(handleSegmentContextMenuEvent, customOnContextMenu)}
                          onPointerDown={composeHandlers(undefined, customOnPointerDown)}
                          onPointerMove={composeHandlers(undefined, customOnPointerMove)}
                          onPointerUp={composeHandlers(undefined, customOnPointerUp)}
                          onPointerCancel={composeHandlers(undefined, customOnPointerCancel)}
                          {...restSegmentProps}
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
                            {...(enableInternalSegmentDrag ? moveHandlers : {})}
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
                          {enableInternalSegmentDrag ? (
                            <>
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
                            </>
                          ) : null}
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
                  {dropPreview ? (
                    <div className="pointer-events-none absolute inset-0">
                      {dropPreview}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {isExternalDragActive && onExternalDrop ? (
              <div
                className={clsx(
                  'relative flex h-[44px] items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/10 text-xs text-muted-foreground transition-colors',
                  externalHover?.laneId === TIMELINE_NEW_LANE_ID ? 'border-primary/70 bg-primary/10 text-primary' : undefined,
                )}
              >
                新しい Duty をここにドロップ
                {renderExternalPreview && activeSession && externalHover?.laneId === TIMELINE_NEW_LANE_ID
                  ? (
                    <div className="pointer-events-none absolute inset-0">
                      {renderExternalPreview({
                        lane: null,
                        laneId: TIMELINE_NEW_LANE_ID,
                        minutes: externalHover.minutes ?? null,
                        segment: null,
                        session: activeSession,
                        bounds,
                        pixelsPerMinute,
                        timelineWidth,
                        isNewLane: true,
                      })}
                    </div>
                  )
                  : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

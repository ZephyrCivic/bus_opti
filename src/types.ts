/**
 * src/types.ts
 * Shared domain model definitions used by scheduling, blocking, and duty editing flows.
 * Keeps React state, service modules, and tests aligned on the same plain TypeScript shapes.
 */
export type DayOfWeek = string;

export interface Driver {
  id: string;
  name: string;
  availability?: DayOfWeek[];
  preferences?: {
    vacationDays?: string[];
  };
}

export interface Route {
  id: string;
  name: string;
  startTime: string; // HH:MM (24h)
  endTime: string; // HH:MM (24h)
  requiredDrivers: number;
  day: DayOfWeek | string;
  startLocation: string;
  endLocation: string;
}

export interface Assignment {
  routeId: string;
  driverId: string;
}

export type Schedule = Record<DayOfWeek, Assignment[]>;

export interface WorkloadItem {
  driverId: string;
  shiftCount: number;
  hours: number;
}

export interface DashboardSummary {
  totalShifts: number;
  totalHours: number;
  unassignedCount: number;
  fairnessScore: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  workloadAnalysis: WorkloadItem[];
  unassignedRoutes: string[];
}

export interface ScheduleState {
  schedule: Schedule | null;
  dashboard: DashboardData;
}

export interface DutySegment {
  id: string;
  blockId: string;
  startTripId: string;
  endTripId: string;
  startSequence: number;
  endSequence: number;
}

export interface Duty {
  id: string;
  driverId?: string;
  segments: DutySegment[];
}

export interface DutySettings {
  maxContinuousMinutes: number;
  minBreakMinutes: number;
  maxDailyMinutes: number;
  undoStackLimit: number;
}

export interface DutyEditState {
  duties: Duty[];
  settings: DutySettings;
  undoStack: Duty[][];
  redoStack: Duty[][];
}

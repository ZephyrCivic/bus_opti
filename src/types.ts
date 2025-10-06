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


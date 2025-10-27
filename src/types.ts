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

export interface DashboardDailyMetric {
  label: string;
  totalShifts: number;
  totalHours: number;
  unassignedCount: number;
  coveragePercentage: number;
}

export interface DashboardAlertHistoryEntry {
  label: string;
  alerts: DashboardAlert[];
}

export interface DashboardSummary {
  totalShifts: number;
  totalHours: number;
  unassignedCount: number;
  fairnessScore: number;
  coveragePercentage: number;
}

export interface DashboardAlert {
  id: 'coverage-low' | 'unassigned-exceeds' | 'fairness-imbalance';
  severity: 'warning' | 'critical';
  message: string;
}

export interface DashboardData {
  summary: DashboardSummary;
  workloadAnalysis: WorkloadItem[];
  driverWorkloads: WorkloadItem[];
  unassignedRoutes: string[];
  alerts: DashboardAlert[];
  dailyMetrics: DashboardDailyMetric[];
  alertHistory: DashboardAlertHistoryEntry[];
}

export interface ScheduleState {
  schedule: Schedule | null;
  dashboard: DashboardData;
}

export type DutySegmentKind = 'drive' | 'break' | 'deadhead';

export interface DutySegment {
  id: string;
  /**
   * 区間の種類。
   * 未設定（既存データ）は従来どおり運行区間として扱う。
   */
  kind?: DutySegmentKind;
  blockId: string;
  startTripId: string;
  endTripId: string;
  startSequence: number;
  endSequence: number;
  /**
   * kind === 'break' の場合、休憩終了後に再開する trip_id を保持する。
   * CSV との往復のため endTripId と同じ値を入れる。
   */
  breakUntilTripId?: string;
  /**
   * kind === 'deadhead' の場合、所要時間（分）を保持する。未指定時は gap を利用。
   */
  deadheadMinutes?: number;
  /**
   * 回送の参照元ルール識別子。from→to など任意の文字列。
   */
  deadheadRuleId?: string;
  /**
   * 回送出発地点の stop/depot/relief ID。
   */
  deadheadFromStopId?: string;
  /**
   * 回送到着地点の stop/depot/relief ID。
   */
  deadheadToStopId?: string;
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
  maxUnassignedPercentage: number;
  maxNightShiftVariance: number;
}

export interface DutyEditState {
  duties: Duty[];
  settings: DutySettings;
  undoStack: Duty[][];
  redoStack: Duty[][];
}

// --- Manual inputs (entered via UI) ---
export interface Depot {
  depotId: string;
  name: string;
  lat: number;
  lon: number;
  openTime?: string; // HH:MM
  closeTime?: string; // HH:MM
  minTurnaroundMin?: number;
}

export interface ReliefPoint {
  reliefId: string;
  name: string;
  lat: number;
  lon: number;
  stopId?: string;
  walkTimeToStopMin?: number;
  allowedWindow?: string; // e.g., 09:00-18:00
}

export interface DeadheadRule {
  fromId: string; // depotId | reliefId | stopId
  toId: string;   // depotId | reliefId | stopId
  mode: 'walk' | 'bus' | 'other';
  travelTimeMin: number;
  distanceKm?: number;
  allowedWindow?: string;
}

export interface ManualDriver {
  driverId: string;
  name: string;
}

export interface LaborRule {
  driverId: string;
  maxContinuousDriveMin?: number;
  minBreakMin?: number;
  maxDutySpanMin?: number;
  maxWorkMin?: number;
  nightWindowStart?: string;
  nightWindowEnd?: string;
  qualifications?: string[];
  affiliation?: string;
}

export interface ManualVehicleType {
  typeId: string;
  name?: string;
  wheelchairAccessible?: boolean;
  lowFloor?: boolean;
  capacitySeated?: number;
  capacityTotal?: number;
  tags?: string;
}

export interface ManualVehicle {
  vehicleId: string;
  vehicleTypeId: string;
  depotId?: string;
  seats?: number;
  wheelchairAccessible?: boolean;
  lowFloor?: boolean;
  notes?: string;
}

export interface LinkingSettings {
  enabled: boolean; // true のとき自動連結を許可
  minTurnaroundMin: number; // 最小折返し
  maxConnectRadiusM: number; // 停留所近接半径
  allowParentStation: boolean; // 親子駅許容
}

export interface BlockMetaEntry {
  vehicleTypeId?: string;
  vehicleId?: string;
}

export interface ManualInputs {
  depots: Depot[];
  reliefPoints: ReliefPoint[];
  deadheadRules: DeadheadRule[];
  drivers: ManualDriver[];
  laborRules: LaborRule[];
  vehicleTypes: ManualVehicleType[];
  vehicles: ManualVehicle[];
  blockMeta: Record<string, BlockMetaEntry>;
  linking: LinkingSettings;
}

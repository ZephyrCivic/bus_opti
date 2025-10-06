/**
 * src/services/duty/constants.ts
 * Shared constants and type utilities used across Duty editing services.
 */
import type { DutySettings } from '@/types';

// Mirrors config.py DUTY_* defaults to avoid drift
export const DEFAULT_DUTY_SETTINGS: DutySettings = {
  maxContinuousMinutes: 240,
  minBreakMinutes: 30,
  maxDailyMinutes: 540,
  undoStackLimit: 50,
};


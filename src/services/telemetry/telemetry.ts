export interface TelemetryEventPayload extends Record<string, unknown> {}

export interface TelemetryEvent {
  type: string;
  timestamp?: string;
  payload?: TelemetryEventPayload;
}

const STORAGE_KEY = 'bus-opti.telemetry.events';
const MAX_EVENTS = 100;

function getNowIso(): string {
  return new Date().toISOString();
}

export function recordTelemetryEvent(event: TelemetryEvent): void {
  const normalized: Required<TelemetryEvent> = {
    type: event.type,
    timestamp: event.timestamp ?? getNowIso(),
    payload: event.payload ?? {},
  };

  if (typeof window === 'undefined') {
    // SSR / テスト環境では console に出力のみ行う。
    // eslint-disable-next-line no-console
    console.info('[telemetry]', normalized);
    return;
  }

  try {
    const existingRaw = window.localStorage?.getItem(STORAGE_KEY);
    const existing: unknown = existingRaw ? JSON.parse(existingRaw) : [];
    const events = Array.isArray(existing) ? existing : [];
    events.push(normalized);
    const trimmed = events.slice(-MAX_EVENTS);
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    if (Array.isArray((window as { __TELEMETRY__?: TelemetryEvent[] }).__TELEMETRY__)) {
      (window as { __TELEMETRY__?: TelemetryEvent[] }).__TELEMETRY__!.push(normalized);
    }
  } catch (error) {
    // localStorage が利用できない場合は console にフォールバック
    // eslint-disable-next-line no-console
    console.info('[telemetry]', normalized, error);
  }
}

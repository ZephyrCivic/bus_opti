/**
 * src/services/privacy/redaction.ts
 * PII（個人識別情報）に関する簡易マスキング・正規化ユーティリティ。
 */

export const REDACTED_LABEL = '匿名化済';

const AUDIT_SAFE_PATTERN = /^[A-Za-z0-9_.\-]+$/;

export interface RedactionResult {
  value: string;
  redacted: boolean;
}

/**
 * 運転士名などの文字列を匿名化する。空文字の場合は変更しない。
 */
export function sanitizeDriverName(raw: string | undefined | null): RedactionResult {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length === 0) {
    return { value: '', redacted: false };
  }
  if (trimmed === REDACTED_LABEL) {
    return { value: REDACTED_LABEL, redacted: false };
  }
  return { value: REDACTED_LABEL, redacted: true };
}

/**
 * 監査ログに記録する前に文字列を検査し、想定外の文字が含まれていれば匿名化する。
 */
export function sanitizeAuditValue(raw: string | undefined | null): string {
  if (typeof raw !== 'string') {
    return '';
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return '';
  }
  return AUDIT_SAFE_PATTERN.test(trimmed) ? trimmed : '[REDACTED]';
}

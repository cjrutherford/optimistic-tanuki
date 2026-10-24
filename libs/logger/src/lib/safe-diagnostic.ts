/** Deliberately closed diagnostics: never serialize arbitrary input or errors. */
export const SAFE_DIAGNOSTIC_CODES = [
  'authorization.check.started',
  'authorization.operation',
  'social.operation',
  'social.comment.requested',
  'social.follow.rejected',
  'profile.operation',
  'diagnostic.rejected',
] as const;
export type SafeDiagnosticCode = (typeof SAFE_DIAGNOSTIC_CODES)[number];
export type SafeDiagnosticLevel = 'log' | 'warn' | 'error' | 'debug';
export interface SafeDiagnosticRecord {
  event: SafeDiagnosticCode;
  outcome?: 'ok' | 'denied' | 'failed' | 'unavailable';
  statusCode?: number;
  count?: number;
}
export interface DiagnosticOutput {
  log(message: unknown): unknown;
  warn?(message: unknown): unknown;
  error?(message: unknown): unknown;
  debug?(message: unknown): unknown;
}

export function emitSafeDiagnostic(
  output: DiagnosticOutput,
  code: unknown,
  metadata?: unknown,
  severity: SafeDiagnosticLevel = 'log'
): void {
  const event = SAFE_DIAGNOSTIC_CODES.includes(code as SafeDiagnosticCode)
    ? (code as SafeDiagnosticCode)
    : 'diagnostic.rejected';
  const record: SafeDiagnosticRecord = { event };
  try {
    // Descriptors avoid invoking getters, toJSON, iterators or inspecting raw errors.
    if (metadata && typeof metadata === 'object') {
      const fields = Object.getOwnPropertyDescriptors(metadata);
      const outcome = fields['outcome']?.value;
      if (['ok', 'denied', 'failed', 'unavailable'].includes(outcome))
        record.outcome = outcome;
      const status = fields['statusCode']?.value;
      if (
        typeof status === 'number' &&
        Number.isInteger(status) &&
        status >= 100 &&
        status <= 599
      )
        record.statusCode = status;
      const count = fields['count']?.value;
      if (
        typeof count === 'number' &&
        Number.isSafeInteger(count) &&
        count >= 0 &&
        count <= 1_000_000
      )
        record.count = count;
    }
  } catch {
    /* Uninspectable metadata is discarded, never stringified. */
  }
  const level = ['log', 'warn', 'error', 'debug'].includes(severity)
    ? severity
    : 'log';
  try {
    const write = output[level] || output.log;
    write.call(output, record);
  } catch {
    /* A diagnostic failure must not change the business operation. */
  }
}

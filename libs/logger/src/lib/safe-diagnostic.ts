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
  event: SafeDiagnosticCode | string;
  outcome?: 'ok' | 'denied' | 'failed' | 'unavailable';
  statusCode?: number;
  count?: number;
}
/**
 * A module-owned set of extra event codes. Each code lists the only fields it
 * may carry, and each field is either a closed list of values or a strict
 * token pattern. Anything else (payloads, emails, tokens, messages) is dropped.
 */
export type SafeEventFieldRule = readonly string[] | RegExp;
export type SafeEventCatalogue = Readonly<
  Record<string, Readonly<Record<string, SafeEventFieldRule>>>
>;
const SAFE_EVENT_CODE_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/;
const SAFE_EVENT_FIELD_PATTERN = /^[a-z][A-Za-z0-9]{0,31}$/;
const RESERVED_FIELDS = ['event', 'outcome', 'statusCode', 'count', 'level'];
const eventCatalogue = new Map<
  string,
  Readonly<Record<string, SafeEventFieldRule>>
>();

/**
 * Register a catalogue of safe event codes for a module. Registration is
 * additive and idempotent for identical rules; it cannot redefine a built-in
 * code or change fields of an already-registered code.
 */
export function registerSafeEventCatalogue(
  catalogue: SafeEventCatalogue
): void {
  for (const [code, fields] of Object.entries(catalogue)) {
    if (!SAFE_EVENT_CODE_PATTERN.test(code))
      throw new Error(`Invalid safe event code: ${code}`);
    if (SAFE_DIAGNOSTIC_CODES.includes(code as SafeDiagnosticCode))
      throw new Error(`Safe event code is built in: ${code}`);
    for (const name of Object.keys(fields)) {
      if (
        !SAFE_EVENT_FIELD_PATTERN.test(name) ||
        RESERVED_FIELDS.includes(name)
      )
        throw new Error(`Invalid safe event field: ${code}.${name}`);
    }
    const existing = eventCatalogue.get(code);
    if (
      existing &&
      JSON.stringify(serializeRules(existing)) !==
        JSON.stringify(serializeRules(fields))
    )
      throw new Error(`Safe event code already registered: ${code}`);
    eventCatalogue.set(code, { ...fields });
  }
}

function serializeRules(fields: Readonly<Record<string, SafeEventFieldRule>>) {
  return Object.entries(fields).map(([name, rule]) => [
    name,
    rule instanceof RegExp ? rule.toString() : [...rule],
  ]);
}

function fieldAllowed(
  rule: SafeEventFieldRule,
  value: unknown
): value is string {
  if (typeof value !== 'string' || value.length > 64) return false;
  return rule instanceof RegExp ? rule.test(value) : rule.includes(value);
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
  const registered =
    typeof code === 'string' ? eventCatalogue.get(code) : undefined;
  const event: string =
    SAFE_DIAGNOSTIC_CODES.includes(code as SafeDiagnosticCode) || registered
      ? (code as string)
      : 'diagnostic.rejected';
  const record: SafeDiagnosticRecord & Record<string, unknown> = { event };
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
      if (registered) {
        for (const [name, rule] of Object.entries(registered)) {
          const value = fields[name]?.value;
          if (fieldAllowed(rule, value)) record[name] = value;
        }
      }
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

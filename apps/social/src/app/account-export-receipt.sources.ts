import { SocialCaptureSource } from './account-export-authored.sources';

export type ReceiptField = {
  kind: 'text' | 'uuid' | 'reference' | 'time' | 'boolean' | 'integer';
  nullable?: boolean;
  max?: number;
};
export type ReceiptFields = Record<string, ReceiptField>;
export const field = {
  text: (nullable = false, max = 4096): ReceiptField => ({
    kind: 'text',
    nullable,
    max,
  }),
  uuid: (nullable = false): ReceiptField => ({ kind: 'uuid', nullable }),
  ref: (nullable = false): ReceiptField => ({
    kind: 'reference',
    nullable,
    max: 512,
  }),
  time: (nullable = false): ReceiptField => ({ kind: 'time', nullable }),
  boolean: (): ReceiptField => ({ kind: 'boolean' }),
  integer: (nullable = false): ReceiptField => ({ kind: 'integer', nullable }),
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function captureInvalid(): never {
  throw new Error('OWNER_CAPTURE_INVALID_RECORD');
}
export function profileScope(table: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) captureInvalid();
  return `"${table}"`;
}
export function accountMatch(column: string): string {
  return `lower(btrim(r."${column}"::text)) = $1`;
}
export function profileMatch(table: string, column: string): string {
  return `EXISTS (SELECT 1 FROM ${profileScope(
    table
  )} p WHERE p.id::text = lower(btrim(r."${column}"::text)))`;
}
export function receiptSource(options: {
  source: string;
  table: string;
  fields: ReceiptFields;
  selector: string;
  checks?: Record<string, string>;
  extraSelect?: string[];
  transform?: (
    data: Record<string, unknown>,
    row: Record<string, unknown>,
    accountId: string
  ) => Record<string, unknown>;
}): SocialCaptureSource {
  const fields: ReceiptFields = { id: field.uuid(), ...options.fields };
  const selections = Object.entries(fields).map(([name, spec]) => {
    const column = `r."${name}"`;
    if (spec.kind === 'boolean' || spec.kind === 'integer')
      return `${column} AS "${name}"`;
    // Text casts avoid the host timezone conversion of timestamp-without-timezone columns.
    const limit =
      spec.kind === 'text' || spec.kind === 'reference' ? spec.max ?? 4096 : 80;
    return `left(${column}::text, ${limit + 1}) AS "${name}"`;
  });
  for (const [key, expression] of Object.entries(options.checks ?? {}))
    selections.push(`(${expression}) AS "${key}"`);
  selections.push(...(options.extraSelect ?? []));
  return {
    source: options.source,
    sql: `SELECT ${selections.join(', ')} FROM "${options.table}" r WHERE (${
      options.selector
    }) AND $1::text IS NOT NULL AND r.id::text COLLATE "C" > COALESCE($2, '') ORDER BY r.id::text COLLATE "C" LIMIT $3`,
    project: (row, accountId) => {
      for (const key of Object.keys(options.checks ?? {}))
        if (row[key] !== true) captureInvalid();
      const data: Record<string, unknown> = {};
      for (const [name, spec] of Object.entries(fields)) {
        const value = row[name];
        if (value === null && spec.nullable) {
          data[name] = null;
          continue;
        }
        if (spec.kind === 'boolean') {
          if (typeof value !== 'boolean') captureInvalid();
          data[name] = value;
        } else if (spec.kind === 'integer') {
          if (typeof value !== 'number' || !Number.isSafeInteger(value))
            captureInvalid();
          data[name] = value;
        } else if (spec.kind === 'uuid') {
          if (typeof value !== 'string' || !UUID.test(value)) captureInvalid();
          data[name] = value.toLowerCase();
        } else if (spec.kind === 'time') {
          if (
            typeof value !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(value)
          )
            captureInvalid();
          const zoned = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(value)
            ? value
            : `${value}Z`;
          const date = new Date(zoned);
          if (!Number.isFinite(date.getTime())) captureInvalid();
          data[name] = date.toISOString();
        } else {
          if (
            typeof value !== 'string' ||
            Array.from(value).length > (spec.max ?? 4096) ||
            (spec.kind === 'reference' &&
              !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,511}$/.test(value))
          )
            captureInvalid();
          data[name] = value;
        }
      }
      const projected = options.transform
        ? options.transform(data, row, accountId)
        : data;
      // Identity erasure can clear identifiers from mixed-party receipts.
      // Nulls are accepted only where the field's reviewed source policy marks
      // it nullable; all non-null values retain the normal strict validation.
      return {
        ...projected,
        attribution: 'recorded-unverified',
        consent: 'not-inferred',
        ...(Object.values(fields).some((x) => x.kind === 'reference')
          ? { references: 'opaque-no-access-grant' }
          : {}),
      };
    },
  };
}

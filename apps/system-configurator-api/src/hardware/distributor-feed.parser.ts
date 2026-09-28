import {
  APPROVED_SUPPLIER_VENDORS,
  SUPPLIER_OFFER_AVAILABILITIES,
  type CreateSupplierOfferDto,
  type SupplierOfferAvailability,
  type SupplierVendor,
} from '@optimistic-tanuki/models';

/**
 * Staff-import format, shared by CSV and JSON:
 *
 * Required fields: provider, sku, productName, unitWholesaleAmount, currency,
 * availability, observedAt. Optional fields: url, hardwarePartId.
 *
 * CSV uses those exact names as its first row. JSON is an array of objects
 * using the same names. Providers and availability values must use the
 * canonical values below. Amounts are decimal major currency units with at
 * most two fractional digits. observedAt must be RFC 3339 with a timezone.
 */

export const DISTRIBUTOR_FEED_CSV_HEADERS = [
  'provider',
  'sku',
  'productName',
  'unitWholesaleAmount',
  'currency',
  'availability',
  'observedAt',
  'url',
  'hardwarePartId',
] as const;

export const DISTRIBUTOR_FEED_PROVIDERS = APPROVED_SUPPLIER_VENDORS;
export const DISTRIBUTOR_FEED_AVAILABILITY = SUPPLIER_OFFER_AVAILABILITIES;

/** A validated offer ready for the supplier-offer persistence layer. */
export type NormalizedDistributorOffer = Omit<
  CreateSupplierOfferDto,
  'observedAt'
> & {
  /** sourceId is derived from sourceSku to provide a stable vendor key. */
  vendor: SupplierVendor;
  availability: SupplierOfferAvailability;
  observedAt: Date;
};

const REQUIRED_HEADERS = DISTRIBUTOR_FEED_CSV_HEADERS.slice(0, 7);
const ALLOWED_HEADERS = new Set<string>(DISTRIBUTOR_FEED_CSV_HEADERS);
const PROVIDERS = new Set<string>(DISTRIBUTOR_FEED_PROVIDERS);
const AVAILABILITY = new Set<string>(DISTRIBUTOR_FEED_AVAILABILITY);

type FeedRecord = Record<string, unknown>;

export function parseDistributorFeed(
  content: string
): NormalizedDistributorOffer[] {
  if (!content.trim()) {
    throw new Error('Distributor feed must not be empty');
  }

  const first = content.trimStart()[0];
  const records =
    first === '[' ? parseJsonRecords(content) : parseCsvRecords(content);
  if (records.length === 0) {
    throw new Error('Distributor feed must contain at least one offer');
  }

  const seenKeys = new Set<string>();
  return records.map((record, index) => {
    const rowNumber = index + 1;
    const offer = normalizeRecord(record, rowNumber);
    const key = `${offer.vendor}\u0000${offer.sourceSku}`;
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate provider and SKU at feed row ${rowNumber}`);
    }
    seenKeys.add(key);
    return offer;
  });
}

function parseJsonRecords(content: string): FeedRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Distributor feed JSON is malformed');
  }
  if (!Array.isArray(parsed) || parsed.some((item) => !isRecord(item))) {
    throw new Error('Distributor feed JSON must be an array of offer objects');
  }
  return parsed as FeedRecord[];
}

function isRecord(value: unknown): value is FeedRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCsvRecords(content: string): FeedRecord[] {
  const rows = parseCsvRows(content);
  while (
    rows.length > 0 &&
    rows[rows.length - 1].every((field) => !field.trim())
  ) {
    rows.pop();
  }
  if (rows.length < 2) {
    throw new Error(
      'CSV distributor feed requires a header and at least one offer'
    );
  }

  const headers = rows[0].map((header) => header.trim());
  const seenHeaders = new Set<string>();
  headers.forEach((header) => {
    if (!ALLOWED_HEADERS.has(header)) {
      throw new Error(
        `CSV contains unsupported header: ${header || '(empty)'}`
      );
    }
    if (seenHeaders.has(header)) {
      throw new Error(`CSV contains duplicate header: ${header}`);
    }
    seenHeaders.add(header);
  });
  for (const header of REQUIRED_HEADERS) {
    if (!seenHeaders.has(header)) {
      throw new Error(`CSV is missing required header: ${header}`);
    }
  }

  return rows
    .slice(1)
    .map((row, index) => {
      if (row.every((field) => !field.trim())) {
        return {};
      }
      if (row.length !== headers.length) {
        throw new Error(
          `CSV row ${index + 2} has ${row.length} fields; expected ${
            headers.length
          }`
        );
      }
      return Object.fromEntries(headers.map((header, i) => [header, row[i]]));
    })
    .filter((row) => Object.keys(row).length > 0);
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (quoted) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (closedQuote && char !== ',' && char !== '\r' && char !== '\n') {
      throw new Error('CSV contains characters after a closing quote');
    }
    if (char === '"') {
      if (field.length !== 0 || closedQuote) {
        throw new Error('CSV contains a quote in an unquoted field');
      }
      quoted = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      closedQuote = false;
      continue;
    }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && content[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      closedQuote = false;
      continue;
    }
    field += char;
  }

  if (quoted) {
    throw new Error('CSV contains an unterminated quoted field');
  }
  if (field.length > 0 || row.length > 0 || closedQuote) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeRecord(
  record: FeedRecord,
  rowNumber: number
): NormalizedDistributorOffer {
  const allowedKeys = new Set([
    'provider',
    'sku',
    'productName',
    'unitWholesaleAmount',
    'currency',
    'availability',
    'observedAt',
    'url',
    'hardwarePartId',
  ]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unexpected field "${key}" at feed row ${rowNumber}`);
    }
  }

  const provider = requiredText(record.provider, 'provider', rowNumber, 64);
  if (!PROVIDERS.has(provider)) {
    throw new Error(
      `Unsupported provider "${provider}" at feed row ${rowNumber}`
    );
  }
  const sku = requiredText(record.sku, 'sku', rowNumber, 255);
  const productName = requiredText(
    record.productName,
    'productName',
    rowNumber,
    512
  );
  assertSafeSpreadsheetText(sku, 'sku', rowNumber);
  assertSafeSpreadsheetText(productName, 'productName', rowNumber);

  const amount = parseAmount(record.unitWholesaleAmount, rowNumber);
  const currency = requiredText(record.currency, 'currency', rowNumber, 3);
  if (!isSupportedCurrency(currency)) {
    throw new Error(
      `Currency must be a supported ISO 4217 code at feed row ${rowNumber}`
    );
  }

  const availability = requiredText(
    record.availability,
    'availability',
    rowNumber,
    24
  );
  if (!AVAILABILITY.has(availability)) {
    throw new Error(
      `Unsupported availability "${availability}" at feed row ${rowNumber}`
    );
  }
  const observedAt = parseObservedAt(record.observedAt, rowNumber);
  const sourceUrl = optionalText(record.url, 'url', rowNumber, 2048);
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    throw new Error(`url must use HTTP or HTTPS at feed row ${rowNumber}`);
  }
  // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted feed URLs.
  if (sourceUrl && /[\u0000-\u001f\u007f]/.test(sourceUrl)) {
    throw new Error(`url contains control characters at feed row ${rowNumber}`);
  }
  const hardwarePartId = optionalText(
    record.hardwarePartId,
    'hardwarePartId',
    rowNumber,
    128
  );
  if (
    hardwarePartId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      hardwarePartId
    )
  ) {
    throw new Error(`hardwarePartId must be a UUID at feed row ${rowNumber}`);
  }

  return {
    vendor: provider as SupplierVendor,
    sourceId: sku,
    sourceSku: sku,
    productName,
    amount,
    currency,
    availability: availability as SupplierOfferAvailability,
    observedAt,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(hardwarePartId ? { hardwarePartId } : {}),
  };
}

function requiredText(
  value: unknown,
  name: string,
  rowNumber: number,
  maxLength: number
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required at feed row ${rowNumber}`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new Error(
      `${name} exceeds ${maxLength} characters at feed row ${rowNumber}`
    );
  }
  // eslint-disable-next-line no-control-regex -- Reject unsupported control characters in untrusted feed text.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new Error(
      `${name} contains unsupported control characters at feed row ${rowNumber}`
    );
  }
  return text;
}

function optionalText(
  value: unknown,
  name: string,
  rowNumber: number,
  maxLength: number
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return requiredText(value, name, rowNumber, maxLength);
}

function assertSafeSpreadsheetText(
  value: string,
  name: string,
  rowNumber: number
): void {
  // eslint-disable-next-line no-control-regex -- Detect spreadsheet formula prefixes after control characters.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(value)) {
    throw new Error(
      `${name} contains spreadsheet formula content at feed row ${rowNumber}`
    );
  }
}

function parseAmount(value: unknown, rowNumber: number): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(
      `unitWholesaleAmount must be a decimal amount at feed row ${rowNumber}`
    );
  }
  const text = String(value).trim();
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) {
    throw new Error(
      `unitWholesaleAmount must be a nonnegative amount with at most two decimals at feed row ${rowNumber}`
    );
  }
  return Number(text);
}

function isSupportedCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) {
    return false;
  }
  const intlWithCurrencyValues = Intl as unknown as {
    supportedValuesOf?: (key: 'currency') => string[];
  };
  if (typeof intlWithCurrencyValues.supportedValuesOf === 'function') {
    return intlWithCurrencyValues.supportedValuesOf('currency').includes(code);
  }
  return new Set([
    'USD',
    'CAD',
    'EUR',
    'GBP',
    'AUD',
    'NZD',
    'JPY',
    'CHF',
    'CNY',
    'MXN',
  ]).has(code);
}

function parseObservedAt(value: unknown, rowNumber: number): Date {
  if (typeof value !== 'string') {
    throw new Error(
      `observedAt must be an RFC 3339 timestamp at feed row ${rowNumber}`
    );
  }
  const text = value.trim();
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(
      text
    );
  if (!match) {
    throw new Error(
      `observedAt must be an RFC 3339 timestamp with timezone at feed row ${rowNumber}`
    );
  }
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    zone,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (zone !== 'Z' &&
      (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59))
  ) {
    throw new Error(
      `observedAt is not a valid calendar timestamp at feed row ${rowNumber}`
    );
  }
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(
      `observedAt is not a valid timestamp at feed row ${rowNumber}`
    );
  }
  return date;
}

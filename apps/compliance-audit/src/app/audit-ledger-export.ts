import { ComplianceAuditLogEntity } from '@optimistic-tanuki/business-security';
import {
  ComplianceAuditExportReport,
  ComplianceAuditLogRecord,
} from '@optimistic-tanuki/models';

export const AUDIT_EXPORT_COLUMNS = [
  'rowType',
  'tenantId',
  'id',
  'action',
  'documentId',
  'fileName',
  'documentHash',
  'previousHash',
  'chainedHash',
  'antivirusStatus',
  'complianceStandard',
  'metadata',
  'timestamp',
  'chainValid',
  'exportedChainValid',
  'fullChainValid',
  'firstBrokenIndex',
  'exportedFirstBrokenIndex',
  'totalRecords',
  'exportedRecords',
  'maxRecords',
  'truncated',
] as const;

const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r', '\n']);

function normalizeJsonValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(source).sort()) {
      result[key] = normalizeJsonValue(source[key]);
    }
    return result;
  }
  return value;
}

function serializeMetadata(value: unknown): string {
  const serialized = JSON.stringify(normalizeJsonValue(value));
  return serialized === undefined ? '' : serialized;
}

function toCellText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return toCellText(value);
}

export function escapeCsvCell(value: unknown): string {
  let text = toCellText(value).replace(/\r\n|\r|\n/g, '\r\n');
  const firstContentCharacter = text.search(/\S/);
  if (
    FORMULA_PREFIXES.has(text[0]) ||
    (firstContentCharacter >= 0 &&
      FORMULA_PREFIXES.has(text[firstContentCharacter]))
  ) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function recordCells(
  record: ComplianceAuditLogRecord | null,
  report: ComplianceAuditExportReport,
  rowType: 'summary' | 'record'
): string[] {
  const isRecord = rowType === 'record' && record !== null;
  return [
    rowType,
    isRecord ? record?.tenantId ?? '' : report.tenantId,
    isRecord ? record?.id ?? '' : '',
    isRecord ? record?.action ?? '' : '',
    isRecord ? record?.documentId ?? '' : '',
    isRecord ? record?.fileName ?? '' : '',
    isRecord ? record?.documentHash ?? '' : '',
    isRecord ? record?.previousHash ?? '' : '',
    isRecord ? record?.chainedHash ?? '' : '',
    isRecord ? record?.antivirusStatus ?? '' : '',
    isRecord ? record?.complianceStandard ?? '' : '',
    isRecord ? serializeMetadata(record?.metadata) : '',
    isRecord ? normalizeTimestamp(record?.timestamp) : '',
    report.chainValid,
    report.exportedChainValid,
    report.fullChainValid,
    report.firstBrokenIndex,
    report.exportedFirstBrokenIndex,
    report.totalRecords,
    report.exportedRecords,
    report.maxRecords,
    report.truncated,
  ].map((value) => escapeCsvCell(value));
}

function normalizedReport(
  report: ComplianceAuditExportReport
): ComplianceAuditExportReport {
  return {
    ...report,
    records: report.records.map((record) => ({
      ...record,
      metadata:
        record.metadata === null || record.metadata === undefined
          ? null
          : (normalizeJsonValue(record.metadata) as Record<string, unknown>),
    })),
  };
}

export function renderComplianceAuditCsv(
  report: ComplianceAuditExportReport
): string {
  const rows = [
    [...AUDIT_EXPORT_COLUMNS].join(','),
    recordCells(null, report, 'summary').join(','),
    ...report.records.map((record) =>
      recordCells(record, report, 'record').join(',')
    ),
  ];
  return `${rows.join('\r\n')}\r\n`;
}

export function renderComplianceAuditJson(
  report: ComplianceAuditExportReport
): string {
  return `${JSON.stringify(normalizedReport(report), null, 2)}\n`;
}

export function toComplianceAuditLogRecord(
  record: ComplianceAuditLogEntity
): ComplianceAuditLogRecord {
  return {
    id: record.id,
    tenantId: record.tenantId,
    action: record.action,
    documentId: record.documentId,
    fileName: record.fileName,
    documentHash: record.documentHash,
    previousHash: record.previousHash,
    chainedHash: record.chainedHash,
    antivirusStatus: record.antivirusStatus,
    complianceStandard: record.complianceStandard,
    metadata: record.metadata,
    timestamp: normalizeTimestamp(record.timestamp),
  };
}

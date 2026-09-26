import { ComplianceAuditLogEntity } from '@optimistic-tanuki/business-security';
import {
  AUDIT_EXPORT_COLUMNS,
  renderComplianceAuditCsv,
  renderComplianceAuditJson,
} from './audit-ledger-export';
import type { ComplianceAuditExportReport } from '@optimistic-tanuki/models';

const documentHash = 'a'.repeat(64);

const record = (
  overrides: Partial<ComplianceAuditLogEntity> = {}
): ComplianceAuditLogEntity =>
  ({
    id: 'audit-1',
    tenantId: 'tenant-a',
    action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
    documentId: 'doc-1',
    fileName: 'return.pdf',
    documentHash,
    previousHash: '0'.repeat(64),
    chainedHash: 'b'.repeat(64),
    antivirusStatus: 'clean',
    complianceStandard: 'WISP',
    metadata: {},
    timestamp: '2026-09-25T12:00:00.000Z',
    ...overrides,
  } as ComplianceAuditLogEntity);

const parseCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\r' && input[index + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      index += 1;
    } else if (character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};

const report = (
  overrides: Partial<ComplianceAuditExportReport> = {}
): ComplianceAuditExportReport => ({
  format: 'csv',
  tenantId: 'tenant-a',
  generatedAt: '2026-09-25T12:00:01.000Z',
  totalRecords: 1,
  exportedRecords: 1,
  maxRecords: 10000,
  truncated: false,
  chainValid: true,
  exportedChainValid: true,
  fullChainValid: true,
  firstBrokenIndex: null,
  exportedFirstBrokenIndex: null,
  records: [record()],
  ...overrides,
});

describe('compliance audit export rendering', () => {
  it('renders deterministic RFC 4180 CSV with a fixed column order', () => {
    const source = report({
      records: [
        record({
          action: 'Review, "approved"\nsecond line',
          fileName: 'return.pdf',
          metadata: { z: 'last', a: 'first' },
        }),
      ],
    });

    const first = renderComplianceAuditCsv(source);
    const second = renderComplianceAuditCsv({
      ...source,
      records: [
        record({
          action: 'Review, "approved"\nsecond line',
          fileName: 'return.pdf',
          metadata: { a: 'first', z: 'last' },
        }),
      ],
    });

    expect(first).toBe(second);
    expect(first.split('\r\n')[0]).toBe(AUDIT_EXPORT_COLUMNS.join(','));
    expect(first).toContain('"Review, ""approved""\r\nsecond line"');
    expect(first).toContain('"{""a"":""first"",""z"":""last""}"');
    expect(first.endsWith('\r\n')).toBe(true);
    const rows = parseCsv(first);
    expect(
      rows.every((row) => row.length === AUDIT_EXPORT_COLUMNS.length)
    ).toBe(true);
    const recordRow = rows.find((row) => row[0] === 'record');
    expect(recordRow?.[3]).toBe('Review, "approved"\r\nsecond line');
    expect(recordRow?.[11]).toBe('{"a":"first","z":"last"}');
  });

  it('neutralizes spreadsheet formula prefixes before CSV escaping', () => {
    const csv = renderComplianceAuditCsv(
      report({
        records: [
          record({
            action: '=SUM(1,2)',
            documentId: '+123',
            fileName: '-unsafe',
            antivirusStatus: '@unsafe',
            complianceStandard: '\tunsafe',
            timestamp: '\runsafe',
          }),
        ],
      })
    );

    expect(csv).toContain('"\'=SUM(1,2)"');
    expect(csv).toContain("'+123");
    expect(csv).toContain("'-unsafe");
    expect(csv).toContain("'@unsafe");
    expect(csv).toContain("'\tunsafe");
    expect(csv).toContain("'\r\nunsafe");
  });

  it('round-trips the report and persisted record fields through JSON', () => {
    const source = report({
      format: 'json',
      records: [
        record({
          action: 'Review, "approved"\nsecond line',
          metadata: { nested: { value: '@preserved' }, list: [1, 2] },
        }),
      ],
    });

    const parsed = JSON.parse(renderComplianceAuditJson(source));

    expect(parsed).toEqual(JSON.parse(JSON.stringify(source)));
    expect(parsed.records[0]).toEqual({
      id: source.records[0].id,
      tenantId: source.records[0].tenantId,
      action: source.records[0].action,
      documentId: source.records[0].documentId,
      fileName: source.records[0].fileName,
      documentHash: source.records[0].documentHash,
      previousHash: source.records[0].previousHash,
      chainedHash: source.records[0].chainedHash,
      antivirusStatus: source.records[0].antivirusStatus,
      complianceStandard: source.records[0].complianceStandard,
      metadata: source.records[0].metadata,
      timestamp: source.records[0].timestamp,
    });
  });
});

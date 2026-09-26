import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  ComplianceAuditLogEntity,
  GENESIS_COMPLIANCE_HASH,
} from '@optimistic-tanuki/business-security';
import { AuditLedgerService } from './audit-ledger.service';

type StoredRow = ComplianceAuditLogEntity & { tenantId: string };

type InMemoryLedger = {
  rows: StoredRow[];
  createManager: () => { manager: EntityManager; release: () => void };
  asDataSource: () => DataSource;
};

/**
 * In-memory stand-in for the `compliance_audit_logs` table. It models the two
 * guarantees the real database provides and the tests depend on:
 *
 * - the tenant RLS session binding, and
 * - the per-tenant serialization from `pg_advisory_xact_lock(hashtext(tenantId))`,
 *   which blocks any other append for the same tenant until this transaction
 *   commits while leaving other tenants unblocked. Without it, five concurrent
 *   appends read the same tail and fork the chain.
 *
 * `rows` is exposed so a test can edit or delete a record to simulate tampering.
 */
const createInMemoryLedger = (): InMemoryLedger => {
  const rows: StoredRow[] = [];
  const chains = new Map<string, Promise<void>>();
  let sequence = 0;

  const acquireTenantLock = async (tenantId: string): Promise<() => void> => {
    const previous = chains.get(tenantId) ?? Promise.resolve();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    chains.set(
      tenantId,
      previous.then(() => held)
    );
    await previous;
    return () => release();
  };

  const rowsFor = (tenantId: string): StoredRow[] =>
    rows
      .filter((row) => row.tenantId === tenantId)
      .map((row) => ({ ...row, metadata: { ...(row.metadata ?? {}) } }))
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  const createManager = (): { manager: EntityManager; release: () => void } => {
    const releases: Array<() => void> = [];

    const manager = {
      queryRunner: {
        query: jest.fn(),
        isTransactionActive: true,
        isReleased: false,
      },
      query: async (sql: string, params: unknown[] = []) => {
        if (sql.includes('pg_advisory_xact_lock')) {
          releases.push(await acquireTenantLock(String(params[0])));
          return [{ pg_advisory_xact_lock: null }];
        }
        throw new Error(`Unexpected raw query: ${sql}`);
      },
      getRepository: () => ({
        create: (values: Partial<StoredRow>) => ({ ...values }),
        save: async (entity: Partial<StoredRow>) => {
          sequence += 1;
          const row = {
            ...(entity as StoredRow),
            id: entity.id ?? `id-${sequence}`,
          } as StoredRow;
          rows.push(row);
          return row;
        },
        update: async (id: string, patch: Partial<StoredRow>) => {
          const row = rows.find((candidate) => candidate.id === id);
          if (!row) {
            throw new Error(`Unknown audit row ${id}`);
          }
          Object.assign(row, patch);
          return { affected: 1 };
        },
        findOne: async ({
          where,
          order,
        }: {
          where: { tenantId: string };
          order: { timestamp: 'ASC' | 'DESC' };
        }) => {
          const matches = rowsFor(where.tenantId);
          if (matches.length === 0) {
            return null;
          }
          return order.timestamp === 'DESC'
            ? matches[matches.length - 1]
            : matches[0];
        },
        find: async ({
          where,
          order,
          skip,
          take,
        }: {
          where: { tenantId: string };
          order: { timestamp: 'ASC' | 'DESC' };
          skip?: number;
          take?: number;
        }) => {
          const matches = rowsFor(where.tenantId);
          const ordered =
            order.timestamp === 'DESC' ? [...matches].reverse() : matches;
          if (skip === undefined && take === undefined) {
            return ordered;
          }
          return ordered.slice(
            skip ?? 0,
            (skip ?? 0) + (take ?? ordered.length)
          );
        },
        count: async ({ where }: { where: { tenantId: string } }) =>
          rowsFor(where.tenantId).length,
      }),
    };

    return {
      manager: manager as unknown as EntityManager,
      release: () => {
        while (releases.length) {
          releases.pop()!();
        }
      },
    };
  };

  return {
    rows,
    createManager,
    asDataSource: () =>
      ({
        transaction: async <T>(
          operation: (manager: EntityManager) => Promise<T>
        ): Promise<T> => {
          const { manager, release } = createManager();
          try {
            return await operation(manager);
          } finally {
            release();
          }
        },
      } as unknown as DataSource),
  };
};

describe('AuditLedgerService', () => {
  let store: InMemoryLedger;
  let service: AuditLedgerService;

  const documentHash = (seed: string): string =>
    createHash('sha256').update(seed).digest('hex');

  const append = (tenantId: string, seed: string) =>
    service.append({
      tenantId,
      action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
      documentId: `doc-${seed}`,
      fileName: `${seed}.pdf`,
      documentHash: documentHash(seed),
      antivirusStatus: 'clean',
    });

  const chainOrder = (): StoredRow[] =>
    [...store.rows].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp)
    );

  beforeEach(() => {
    store = createInMemoryLedger();
    service = new AuditLedgerService(store.asDataSource());
  });

  it('anchors the first event of a tenant to the genesis hash', async () => {
    const first = await append('tenant-a', 'one');

    expect(first.previousHash).toBe(GENESIS_COMPLIANCE_HASH);
    expect(first.chainedHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('chains every event of a tenant to its predecessor', async () => {
    const first = await append('tenant-a', 'one');
    const second = await append('tenant-a', 'two');
    const third = await append('tenant-a', 'three');

    expect(second.previousHash).toBe(first.chainedHash);
    expect(third.previousHash).toBe(second.chainedHash);
    expect(
      new Set([first.chainedHash, second.chainedHash, third.chainedHash]).size
    ).toBe(3);
  });

  it('verifies an untouched chain end to end', async () => {
    await append('tenant-a', 'one');
    await append('tenant-a', 'two');

    const result = await service.verify('tenant-a');

    expect(result.valid).toBe(true);
    expect(result.firstBrokenIndex).toBeNull();
    expect(result.totalRecords).toBe(2);
    expect(result.lastHash).toBe(chainOrder()[1].chainedHash);
  });

  it('verifies a chain longer than one window without loading it at once', async () => {
    await append('tenant-a', 'one');
    await append('tenant-a', 'two');
    await append('tenant-a', 'three');
    await append('tenant-a', 'four');
    await append('tenant-a', 'five');

    const result = await service.verify('tenant-a', 2);

    expect(result.valid).toBe(true);
    expect(result.totalRecords).toBe(5);
    expect(result.lastHash).toBe(chainOrder()[4].chainedHash);
    expect(result.firstBrokenIndex).toBeNull();
  });

  it('finds a break past the first window boundary', async () => {
    await append('tenant-a', 'one');
    await append('tenant-a', 'two');
    await append('tenant-a', 'three');
    await append('tenant-a', 'four');

    store.rows[3].documentHash = documentHash('tampered');

    const result = await service.verify('tenant-a', 2);

    expect(result.valid).toBe(false);
    expect(result.firstBrokenIndex).toBe(3);
    expect(result.totalRecords).toBe(4);
  });

  it('verifies an empty chain as valid', async () => {
    const result = await service.verify('tenant-a');

    expect(result.valid).toBe(true);
    expect(result.totalRecords).toBe(0);
    expect(result.lastHash).toBe(GENESIS_COMPLIANCE_HASH);
  });

  it('reports a truthful failure and the first broken index when a record is edited', async () => {
    await append('tenant-a', 'one');
    await append('tenant-a', 'two');
    await append('tenant-a', 'three');

    store.rows[1].documentHash = documentHash('tampered');

    const result = await service.verify('tenant-a');

    expect(result.valid).toBe(false);
    expect(result.firstBrokenIndex).toBe(1);
  });

  it('reports a broken link when a record is relinked to the genesis hash', async () => {
    await append('tenant-a', 'one');
    await append('tenant-a', 'two');

    store.rows[1].previousHash = GENESIS_COMPLIANCE_HASH;

    const result = await service.verify('tenant-a');

    expect(result.valid).toBe(false);
    expect(result.firstBrokenIndex).toBe(1);
  });

  it('reports a broken link when a record is deleted from the middle', async () => {
    await append('tenant-a', 'one');
    await append('tenant-a', 'two');
    await append('tenant-a', 'three');

    store.rows.splice(1, 1);

    const result = await service.verify('tenant-a');

    expect(result.valid).toBe(false);
    expect(result.firstBrokenIndex).toBe(1);
  });

  it('reports a broken genesis link when the first record is swapped', async () => {
    await append('tenant-a', 'one');
    await append('tenant-a', 'two');

    const first = store.rows[0];
    first.previousHash = 'd'.repeat(64);

    await expect(service.verify('tenant-a')).resolves.toMatchObject({
      valid: false,
      firstBrokenIndex: 0,
    });
  });

  it('keeps separate chains per tenant', async () => {
    const a1 = await append('tenant-a', 'a-one');
    const b1 = await append('tenant-b', 'b-one');
    const a2 = await append('tenant-a', 'a-two');
    const b2 = await append('tenant-b', 'b-two');

    expect(a2.previousHash).toBe(a1.chainedHash);
    expect(b2.previousHash).toBe(b1.chainedHash);
    await expect(service.verify('tenant-a')).resolves.toMatchObject({
      valid: true,
    });
    await expect(service.verify('tenant-b')).resolves.toMatchObject({
      valid: true,
    });
  });

  it('never returns another tenant rows from a paginated read', async () => {
    await append('tenant-a', 'a-one');
    await append('tenant-a', 'a-two');
    await append('tenant-b', 'b-one');

    const page = await service.list('tenant-a');

    expect(page.totalRecords).toBe(2);
    expect(page.records).toHaveLength(2);
    expect(page.records.every((row) => row.tenantId === 'tenant-a')).toBe(true);
    expect(page.records.map((row) => row.documentId)).toEqual([
      'doc-a-one',
      'doc-a-two',
    ]);
  });

  it('binds the tenant RLS session before touching the table', async () => {
    const bound: string[] = [];
    const dataSource = createInMemoryLedger();
    const serviceWithSpy = new AuditLedgerService({
      transaction: async (
        operation: (manager: EntityManager) => Promise<unknown>
      ) => {
        const { manager, release } = dataSource.createManager();
        const original = manager.queryRunner.query;
        manager.queryRunner.query = ((query: string, params: unknown[]) => {
          bound.push(String(params?.[0] ?? ''));
          return original(query, params);
        }) as never;
        try {
          return await operation(manager);
        } finally {
          release();
        }
      },
    } as unknown as DataSource);

    await serviceWithSpy.append({
      tenantId: 'tenant-a',
      action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
      documentHash: documentHash('rls'),
    });

    expect(bound).toEqual(['tenant-a']);
  });

  it('binds the tenant RLS session before reading an export', async () => {
    const bound: string[] = [];
    const dataSource = createInMemoryLedger();
    const serviceWithSpy = new AuditLedgerService({
      transaction: async (
        operation: (manager: EntityManager) => Promise<unknown>
      ) => {
        const { manager, release } = dataSource.createManager();
        const original = manager.queryRunner.query;
        manager.queryRunner.query = ((query: string, params: unknown[]) => {
          bound.push(String(params?.[0] ?? ''));
          return original(query, params);
        }) as never;
        try {
          return await operation(manager);
        } finally {
          release();
        }
      },
    } as unknown as DataSource);

    await serviceWithSpy.exportWispAudit('tenant-a', 'json');

    expect(bound).toEqual(['tenant-a']);
  });

  it('rejects an append with no tenant context', async () => {
    await expect(
      service.append({
        tenantId: '',
        action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
        documentHash: documentHash('no-tenant'),
      })
    ).rejects.toThrow(BadRequestException);
    expect(store.rows).toHaveLength(0);
  });

  it('rejects an append with a missing document hash', async () => {
    await expect(
      service.append({
        tenantId: 'tenant-a',
        action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
        documentHash: undefined as unknown as string,
      })
    ).rejects.toThrow(BadRequestException);
    expect(store.rows).toHaveLength(0);
  });

  it.each(['not-a-hash', 'a'.repeat(63), 'z'.repeat(64), `${'a'.repeat(63)}g`])(
    'rejects the invalid document hash %s',
    async (hash) => {
      await expect(
        service.append({
          tenantId: 'tenant-a',
          action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
          documentHash: hash,
        })
      ).rejects.toThrow(BadRequestException);
      expect(store.rows).toHaveLength(0);
    }
  );

  it('rejects a caller-supplied previousHash', async () => {
    await expect(
      service.append({
        tenantId: 'tenant-a',
        action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
        documentHash: documentHash('caller-hash'),
        previousHash: 'f'.repeat(64),
      } as never)
    ).rejects.toThrow(BadRequestException);
    expect(store.rows).toHaveLength(0);
  });

  it('rejects a caller-supplied chainedHash', async () => {
    await expect(
      service.append({
        tenantId: 'tenant-a',
        action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
        documentHash: documentHash('caller-hash'),
        chainedHash: 'f'.repeat(64),
      } as never)
    ).rejects.toThrow(BadRequestException);
    expect(store.rows).toHaveLength(0);
  });

  it('rejects a caller-supplied timestamp', async () => {
    await expect(
      service.append({
        tenantId: 'tenant-a',
        action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
        documentHash: documentHash('caller-timestamp'),
        timestamp: '2020-01-01T00:00:00.000Z',
      } as never)
    ).rejects.toThrow(BadRequestException);
    expect(store.rows).toHaveLength(0);
  });

  it('rejects a blank action', async () => {
    await expect(
      service.append({
        tenantId: 'tenant-a',
        action: '   ',
        documentHash: documentHash('blank-action'),
      })
    ).rejects.toThrow(BadRequestException);
    expect(store.rows).toHaveLength(0);
  });

  it('serializes concurrent appends for the same tenant without forking the chain', async () => {
    const results = await Promise.all([
      append('tenant-a', 'c1'),
      append('tenant-a', 'c2'),
      append('tenant-a', 'c3'),
      append('tenant-a', 'c4'),
      append('tenant-a', 'c5'),
    ]);

    const stored = chainOrder();
    expect(stored).toHaveLength(5);
    expect(new Set(stored.map((row) => row.id)).size).toBe(5);
    expect(new Set(results.map((record) => record.id)).size).toBe(5);

    for (let index = 0; index < stored.length; index += 1) {
      const expectedPrevious =
        index === 0 ? GENESIS_COMPLIANCE_HASH : stored[index - 1].chainedHash;
      expect(stored[index].previousHash).toBe(expectedPrevious);
      expect(
        ComplianceAuditLogEntity.computeChainedHash(
          ComplianceAuditLogEntity.canonicalFields(stored[index])
        )
      ).toBe(stored[index].chainedHash);
    }

    await expect(service.verify('tenant-a')).resolves.toMatchObject({
      valid: true,
      totalRecords: 5,
    });
  });

  it('serializes concurrent appends across different tenants independently', async () => {
    const results = await Promise.all([
      append('tenant-a', 'x1'),
      append('tenant-b', 'y1'),
      append('tenant-a', 'x2'),
      append('tenant-b', 'y2'),
    ]);

    expect(new Set(results.map((record) => record.tenantId))).toEqual(
      new Set(['tenant-a', 'tenant-b'])
    );
    await expect(service.verify('tenant-a')).resolves.toMatchObject({
      valid: true,
      totalRecords: 2,
    });
    await expect(service.verify('tenant-b')).resolves.toMatchObject({
      valid: true,
      totalRecords: 2,
    });
  });

  it('assigns a strictly increasing timestamp so chain order is total', async () => {
    const first = await append('tenant-a', 't1');
    const second = await append('tenant-a', 't2');

    expect(new Date(second.timestamp).getTime()).toBeGreaterThan(
      new Date(first.timestamp).getTime()
    );
  });

  it('paginates a tenant chain without dropping or duplicating records', async () => {
    for (const seed of ['p1', 'p2', 'p3', 'p4', 'p5']) {
      await append('tenant-a', seed);
    }

    const first = await service.list('tenant-a', { page: 1, limit: 2 });
    const second = await service.list('tenant-a', { page: 2, limit: 2 });
    const third = await service.list('tenant-a', { page: 3, limit: 2 });

    expect(first.records.map((row) => row.documentId)).toEqual([
      'doc-p1',
      'doc-p2',
    ]);
    expect(second.records.map((row) => row.documentId)).toEqual([
      'doc-p3',
      'doc-p4',
    ]);
    expect(third.records.map((row) => row.documentId)).toEqual(['doc-p5']);
    expect(first.totalRecords).toBe(5);
    expect(second.totalRecords).toBe(5);
    expect(third.totalRecords).toBe(5);
  });

  it.each([
    { page: 0 },
    { page: -1 },
    { page: 1.5 },
    { limit: 0 },
    { limit: -5 },
    { limit: 501 },
    { limit: 2.5 },
  ])('rejects the invalid page options %p', async (options) => {
    await append('tenant-a', 'paging');

    await expect(service.list('tenant-a', options as never)).rejects.toThrow(
      BadRequestException
    );
  });

  it('rejects a list, verify or report with no tenant context', async () => {
    await expect(service.list('')).rejects.toThrow(BadRequestException);
    await expect(service.verify('   ')).rejects.toThrow(BadRequestException);
    await expect(service.page(undefined as unknown as string)).rejects.toThrow(
      BadRequestException
    );
    await expect(
      service.wispReport(undefined as unknown as string)
    ).rejects.toThrow(BadRequestException);
  });

  it('reports a WISP report whose chain validity covers the whole chain', async () => {
    await append('tenant-a', 'w1');
    await append('tenant-a', 'w2');
    await append('tenant-a', 'w3');

    const report = await service.wispReport('tenant-a', { limit: 1 });

    expect(report.records).toHaveLength(1);
    expect(report.totalRecords).toBe(3);
    expect(report.chainValid).toBe(true);
    expect(report.complianceStandard).toContain('16 CFR Part 314');

    store.rows[2].documentHash = documentHash('wisp-tampered');

    const tampered = await service.wispReport('tenant-a', { limit: 1 });
    expect(tampered.chainValid).toBe(false);
  });

  it('does not mark a non-scanned record as WISP compliant', async () => {
    const record = await service.append({
      tenantId: 'tenant-a',
      action: 'ESCROW_WIRE_REVEALED',
      documentHash: documentHash('not-scanned'),
    });

    const report = await service.wispReport('tenant-a');

    expect(report.records[0].antivirusStatus).toBe('skipped');
    expect(report.records[0].wispCompliant).toBe(false);
    expect(report.records[0].id).toBe(record.id);
  });

  it('exports the persisted chain as JSON with chain-integrity evidence', async () => {
    await append('tenant-a', 'export-one');
    await append('tenant-a', 'export-two');

    const exported = await service.exportWispAudit('tenant-a', 'json');
    const parsed = JSON.parse(exported.content);

    expect(exported.contentType).toBe('application/json; charset=utf-8');
    expect(exported.filename).toBe('wisp-compliance-audit-tenant-a.json');
    expect(parsed.records).toEqual(
      store.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        action: row.action,
        documentId: row.documentId,
        fileName: row.fileName,
        documentHash: row.documentHash,
        previousHash: row.previousHash,
        chainedHash: row.chainedHash,
        antivirusStatus: row.antivirusStatus,
        complianceStandard: row.complianceStandard,
        metadata: row.metadata,
        timestamp: row.timestamp,
      }))
    );
    expect(parsed).toMatchObject({
      tenantId: 'tenant-a',
      totalRecords: 2,
      exportedRecords: 2,
      truncated: false,
      chainValid: true,
      exportedChainValid: true,
      fullChainValid: true,
      firstBrokenIndex: null,
      exportedFirstBrokenIndex: null,
    });
  });

  it('produces stable JSON bytes for unchanged persisted data', async () => {
    await append('tenant-a', 'stable-one');
    await append('tenant-a', 'stable-two');

    const first = await service.exportWispAudit('tenant-a', 'json');
    const second = await service.exportWispAudit('tenant-a', 'json');

    expect(second.content).toBe(first.content);
  });

  it('reports a tampered persisted chain as invalid in the export', async () => {
    await append('tenant-a', 'export-tamper-one');
    await append('tenant-a', 'export-tamper-two');

    store.rows[1].documentHash = documentHash('export-tampered');

    const exported = await service.exportWispAudit('tenant-a', 'json');

    expect(exported).toMatchObject({
      chainValid: false,
      exportedChainValid: false,
      fullChainValid: false,
      firstBrokenIndex: 1,
      exportedFirstBrokenIndex: 1,
    });
    expect(JSON.parse(exported.content)).toMatchObject({
      chainValid: false,
      fullChainValid: false,
    });
  });

  it('reports truncation and keeps a partial export distinct from a complete chain', async () => {
    await append('tenant-a', 'export-cap-one');
    await append('tenant-a', 'export-cap-two');

    const exported = await service.exportWispAudit('tenant-a', 'json', {
      maxRecords: 1,
    });

    expect(exported).toMatchObject({
      maxRecords: 1,
      totalRecords: 2,
      exportedRecords: 1,
      truncated: true,
      chainValid: false,
      exportedChainValid: true,
      fullChainValid: true,
    });
    expect(exported.records).toHaveLength(1);
    expect(exported.records[0].id).toBe(store.rows[0].id);
  });

  it('keeps a regulatory export scoped to one tenant', async () => {
    await append('tenant-a', 'export-tenant-a');
    await append('tenant-b', 'export-tenant-b');

    const exported = await service.exportWispAudit('tenant-a', 'json');

    expect(exported.records).toHaveLength(1);
    expect(exported.records[0].tenantId).toBe('tenant-a');
    expect(exported.content).not.toContain('export-tenant-b');
  });

  it('rejects an unsupported export format', async () => {
    await expect(
      service.exportWispAudit('tenant-a', 'xml' as never)
    ).rejects.toThrow(BadRequestException);
  });

  it('does not persist a row when the transaction aborts', async () => {
    const failing = new AuditLedgerService({
      transaction: async () => {
        throw new Error('deadlock detected');
      },
    } as unknown as DataSource);

    await expect(
      failing.append({
        tenantId: 'tenant-a',
        action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
        documentHash: documentHash('rollback'),
      })
    ).rejects.toThrow('deadlock detected');
    expect(store.rows).toHaveLength(0);
  });
});

import { Logger, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  ComplianceAuditLogEntity,
  GENESIS_COMPLIANCE_HASH,
} from './compliance-audit-log.entity';
import { ComplianceAuditService } from './compliance-audit.service';
import { ComplianceAuditInterceptor } from './compliance-audit.interceptor';
import { COMPLIANCE_AUDITED_KEY } from './compliance-audited.decorator';

describe('ComplianceAudit Chained SHA-256 Ledger', () => {
  let service: ComplianceAuditService;

  beforeEach(() => {
    service = new ComplianceAuditService();
  });

  function getMemoryLog(): ComplianceAuditLogEntity[] {
    return (service as unknown as { memoryLog: ComplianceAuditLogEntity[] })
      .memoryLog;
  }

  type BoundedOptions = {
    maxRecords: number;
    maxRecordsPerTenant: number;
  };

  function createBoundedService(
    options: BoundedOptions
  ): ComplianceAuditService {
    const Constructor = ComplianceAuditService as unknown as new (
      options: BoundedOptions
    ) => ComplianceAuditService;
    return new Constructor(options);
  }

  it('computes deterministic chained SHA-256 hashes', () => {
    const fixedDate = new Date('2026-09-24T12:00:00.000Z');
    const fields = {
      id: 'document-1-id',
      action: 'DOCUMENT_ACCESS',

      documentId: 'document-1',
      fileName: 'document.pdf',
      documentHash: 'doc-hash-1',
      antivirusStatus: 'clean',
      complianceStandard: 'STANDARD',
      metadata: { source: 'test', nested: { value: 1 } },
      timestamp: fixedDate.toISOString(),
      tenantId: 'tenant-cpa-1',
      previousHash: GENESIS_COMPLIANCE_HASH,
    };
    const hash1 = ComplianceAuditLogEntity.computeChainedHash(fields);
    const hash2 = ComplianceAuditLogEntity.computeChainedHash({
      ...fields,
      metadata: { nested: { value: 1 }, source: 'test' },
    });
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it('stores immutable ISO timestamps and protects the ledger from mutation', async () => {
    const record = await service.recordAudit({
      tenantId: 'tenant-immutable-timestamp',
      action: 'IMMUTABLE_TIMESTAMP',
      documentHash: 'document-hash',
      timestamp: new Date('2026-09-24T12:00:00.000Z'),
      metadata: { nested: { value: 'original' } },
    });
    const originalTimestamp = record.timestamp;
    const [returned] = await service.getAuditLogs('tenant-immutable-timestamp');

    expect(typeof originalTimestamp).toBe('string');
    expect(returned.timestamp).toBe(originalTimestamp);
    expect(() => {
      (record as unknown as { timestamp: string }).timestamp =
        '2026-09-24T13:00:00.000Z';
    }).toThrow();
    expect(() => {
      (returned as unknown as { timestamp: string }).timestamp =
        '2026-09-24T13:00:00.000Z';
    }).toThrow();
    expect(() => {
      (returned.metadata['nested'] as { value: string }).value = 'mutated';
    }).toThrow();
    expect(returned.timestamp).toBe(originalTimestamp);
    expect(returned.metadata['nested']).toEqual({ value: 'original' });
    expect(
      (await service.verifyIntegrity('tenant-immutable-timestamp')).valid
    ).toBe(true);
  });

  it('defaults missing scan status to not_scanned', async () => {
    const record = await service.recordAudit({
      tenantId: 'tenant-default-scan',
      action: 'NO_SCAN',
      documentHash: 'document-hash',
    });

    expect(record.antivirusStatus).toBe('not_scanned');
  });

  it('snapshots and freezes metadata and returned record fields', async () => {
    const metadata = {
      actor: { id: 'actor-1' },
      nested: { value: 'original' },
    };
    const record = await service.recordAudit({
      tenantId: 'tenant-frozen',
      action: 'FROZEN_METADATA',
      documentHash: 'document-hash',
      metadata,
    });

    metadata.actor.id = 'mutated-input';
    metadata.nested.value = 'mutated-input';
    expect(record.metadata).toEqual({
      actor: { id: 'actor-1' },
      nested: { value: 'original' },
    });
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.metadata)).toBe(true);
    expect(Object.isFrozen(record.metadata['actor'])).toBe(true);
    expect(Object.isFrozen(record.metadata['nested'])).toBe(true);
    expect(Object.isFrozen(record.timestamp)).toBe(true);

    const returned = await service.getAuditLogs('tenant-frozen');
    expect(returned[0]).toBe(record);
    expect(Object.isFrozen(returned[0])).toBe(true);
    expect((await service.verifyIntegrity('tenant-frozen')).valid).toBe(true);
  });

  it('keeps a cleared chain compromised until an explicit reset', async () => {
    await service.recordAudit({
      tenantId: 'tenant-clear-anchor',
      action: 'CLEARED_RECORD',
      documentHash: 'document-hash',
    });
    expect((await service.verifyIntegrity('tenant-clear-anchor')).valid).toBe(
      true
    );

    service.clear();
    const afterClear = await service.verifyIntegrity('tenant-clear-anchor');
    expect(afterClear.valid).toBe(false);
    expect(afterClear.totalRecords).toBe(0);

    const reset = (service as unknown as { reset?: () => void }).reset;
    expect(typeof reset).toBe('function');
    reset?.call(service);
    expect((await service.verifyIntegrity('tenant-clear-anchor')).valid).toBe(
      true
    );
  });

  it('rejects appends at the total memory limit without changing the ledger', async () => {
    const boundedService = createBoundedService({
      maxRecords: 2,
      maxRecordsPerTenant: 2,
    });
    await boundedService.recordAudit({
      tenantId: 'tenant-total-a',
      action: 'TOTAL_A',
      documentHash: 'hash-a',
    });
    const second = await boundedService.recordAudit({
      tenantId: 'tenant-total-b',
      action: 'TOTAL_B',
      documentHash: 'hash-b',
    });
    const before = await boundedService.verifyIntegrity('tenant-total-b');

    await expect(
      boundedService.recordAudit({
        tenantId: 'tenant-total-a',
        action: 'TOTAL_REJECTED',
        documentHash: 'hash-rejected',
      })
    ).rejects.toThrow(ServiceUnavailableException);

    expect((await boundedService.getAuditLogs()).length).toBe(2);
    expect(await boundedService.verifyIntegrity('tenant-total-b')).toEqual(
      before
    );
    expect(
      (await boundedService.verifyIntegrity('tenant-total-b')).lastHash
    ).toBe(second.chainedHash);
  });

  it('rejects appends at the per-tenant memory limit without changing the anchor', async () => {
    const boundedService = createBoundedService({
      maxRecords: 4,
      maxRecordsPerTenant: 1,
    });
    const first = await boundedService.recordAudit({
      tenantId: 'tenant-limited',
      action: 'TENANT_LIMITED',
      documentHash: 'hash-first',
    });
    const before = await boundedService.verifyIntegrity('tenant-limited');

    await expect(
      boundedService.recordAudit({
        tenantId: 'tenant-limited',
        action: 'TENANT_REJECTED',
        documentHash: 'hash-rejected',
      })
    ).rejects.toThrow(ServiceUnavailableException);

    expect((await boundedService.getAuditLogs('tenant-limited')).length).toBe(
      1
    );
    expect(await boundedService.verifyIntegrity('tenant-limited')).toEqual(
      before
    );
    expect(
      (await boundedService.getAuditLogs('tenant-limited'))[0].chainedHash
    ).toBe(first.chainedHash);
  });

  it('allows another tenant after one tenant reaches its limit', async () => {
    const boundedService = createBoundedService({
      maxRecords: 3,
      maxRecordsPerTenant: 1,
    });
    await boundedService.recordAudit({
      tenantId: 'tenant-full',
      action: 'FULL',
      documentHash: 'hash-full',
    });

    await expect(
      boundedService.recordAudit({
        tenantId: 'tenant-full',
        action: 'FULL_REJECTED',
        documentHash: 'hash-rejected',
      })
    ).rejects.toThrow(ServiceUnavailableException);

    const other = await boundedService.recordAudit({
      tenantId: 'tenant-other',
      action: 'OTHER',
      documentHash: 'hash-other',
    });

    expect(other.tenantId).toBe('tenant-other');
    expect((await boundedService.getAuditLogs()).length).toBe(2);
    expect((await boundedService.verifyIntegrity('tenant-full')).valid).toBe(
      true
    );
    expect((await boundedService.verifyIntegrity('tenant-other')).valid).toBe(
      true
    );
  });

  it('hashes own __proto__ metadata keys without prototype collisions', async () => {
    const firstMetadata = JSON.parse(
      '{"__proto__":{"marker":"first"},"nested":{"__proto__":{"marker":"nested-first"},"safe":1}}'
    ) as Record<string, unknown>;
    const secondMetadata = JSON.parse(
      '{"__proto__":{"marker":"second"},"nested":{"__proto__":{"marker":"nested-second"},"safe":1}}'
    ) as Record<string, unknown>;
    const first = await service.recordAudit({
      tenantId: 'tenant-proto-first',
      action: 'PROTO_METADATA',
      documentHash: 'document-hash',
      metadata: firstMetadata,
    });
    const second = await service.recordAudit({
      tenantId: 'tenant-proto-second',
      action: 'PROTO_METADATA',
      documentHash: 'document-hash',
      metadata: secondMetadata,
    });

    expect(first.chainedHash).not.toBe(second.chainedHash);
    expect(
      Object.prototype.hasOwnProperty.call(first.metadata, '__proto__')
    ).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(
        first.metadata['nested'] as Record<string, unknown>,
        '__proto__'
      )
    ).toBe(true);
    expect(
      (Object.prototype as Record<string, unknown>)['marker']
    ).toBeUndefined();
    expect((await service.verifyIntegrity('tenant-proto-first')).valid).toBe(
      true
    );
    expect((await service.verifyIntegrity('tenant-proto-second')).valid).toBe(
      true
    );
  });

  it('normalizes nested Buffer metadata to an immutable JSON-safe snapshot', async () => {
    const source = Buffer.from([0, 1, 2, 255]);
    const record = await service.recordAudit({
      tenantId: 'tenant-buffer-metadata',
      action: 'BUFFER_METADATA',
      documentHash: 'document-hash',
      metadata: {
        nested: { payload: source },
        values: [source],
      },
    });
    const [returned] = await service.getAuditLogs('tenant-buffer-metadata');
    const expected = {
      type: 'Buffer',
      encoding: 'base64',
      data: source.toString('base64'),
    };

    expect(record.metadata['nested']).toEqual({ payload: expected });
    expect(record.metadata['values']).toEqual([expected]);
    expect(Buffer.isBuffer(record.metadata['nested'])).toBe(false);
    expect(Object.isFrozen(record.metadata['nested'])).toBe(true);
    expect(
      Object.isFrozen(
        (record.metadata['nested'] as { payload: unknown }).payload
      )
    ).toBe(true);

    source[0] = 99;
    expect(returned.metadata['nested']).toEqual({ payload: expected });
    expect(
      (await service.verifyIntegrity('tenant-buffer-metadata')).valid
    ).toBe(true);
  });

  it('does not log tenant identifiers', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await service.recordAudit({
      tenantId: 'private-tenant-identifier',
      action: 'DOCUMENT_ACCESS',
      documentHash: 'document-hash',
    });

    expect(logSpy.mock.calls.flat().join(' ')).not.toContain(
      'private-tenant-identifier'
    );
    logSpy.mockRestore();
  });

  it('records consecutive audit entries with cryptographic continuity', async () => {
    const log1 = await service.recordAudit({
      tenantId: 'tenant-1040',
      action: 'TAX_RETURN_UPLOAD',
      documentHash:
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      fileName: 'Form-1040.pdf',
    });
    expect(log1.previousHash).toBe(GENESIS_COMPLIANCE_HASH);

    const log2 = await service.recordAudit({
      tenantId: 'tenant-1040',
      action: 'SCHEDULE_C_UPLOAD',
      documentHash:
        'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      fileName: 'Schedule-C.pdf',
    });
    expect(log2.previousHash).toBe(log1.chainedHash);

    const integrity = await service.verifyIntegrity('tenant-1040');
    expect(integrity.valid).toBe(true);
    expect(integrity.totalRecords).toBe(2);
  });

  it.each([
    [
      'id',
      (record: ComplianceAuditLogEntity) => {
        record.id = 'ALTERED_ID';
      },
    ],
    [
      'action',
      (record: ComplianceAuditLogEntity) => {
        record.action = 'ALTERED_ACTION';
      },
    ],
    [
      'metadata',
      (record: ComplianceAuditLogEntity) => {
        record.metadata = { source: 'altered' };
      },
    ],
    [
      'compliance standard',
      (record: ComplianceAuditLogEntity) => {
        record.complianceStandard = 'ALTERED_STANDARD';
      },
    ],
    [
      'antivirus status',
      (record: ComplianceAuditLogEntity) => {
        record.antivirusStatus = 'infected';
      },
    ],
  ])('detects %s tampering in the audit chain', async (_field, tamper) => {
    await service.recordAudit({
      tenantId: 'tenant-canonical',
      action: 'DOCUMENT_ACCESS',
      documentId: 'document-1',
      fileName: 'document.pdf',
      documentHash: 'document-hash',
      antivirusStatus: 'clean',
      complianceStandard: 'STANDARD',
      metadata: { source: 'original', nested: { value: 1 } },
    });
    const [record] = await service.getAuditLogs('tenant-canonical');
    const mutableRecord = {
      ...record,
      metadata: record.metadata ? { ...record.metadata } : record.metadata,
    };
    tamper(mutableRecord);
    getMemoryLog()[0] = mutableRecord;

    expect((await service.verifyIntegrity('tenant-canonical')).valid).toBe(
      false
    );
  });

  it('detects alteration of the genesis previous hash', async () => {
    await service.recordAudit({
      tenantId: 'tenant-genesis',
      action: 'DOCUMENT_ACCESS',
      documentHash: 'document-hash',
    });
    const [record] = await service.getAuditLogs('tenant-genesis');
    const mutableRecord = { ...record };
    mutableRecord.previousHash = '1'.repeat(64);
    mutableRecord.chainedHash = ComplianceAuditLogEntity.computeChainedHash(
      ComplianceAuditLogEntity.canonicalFields(mutableRecord)
    );
    getMemoryLog()[0] = mutableRecord;

    expect((await service.verifyIntegrity('tenant-genesis')).valid).toBe(false);
  });

  it('verifies interleaved records per tenant', async () => {
    const tenantAFirst = await service.recordAudit({
      tenantId: 'tenant-a',
      action: 'A_FIRST',
      documentHash: 'a-first',
    });
    await service.recordAudit({
      tenantId: 'tenant-b',
      action: 'B_FIRST',
      documentHash: 'b-first',
    });
    const tenantASecond = await service.recordAudit({
      tenantId: 'tenant-a',
      action: 'A_SECOND',
      documentHash: 'a-second',
    });
    await service.recordAudit({
      tenantId: 'tenant-b',
      action: 'B_SECOND',
      documentHash: 'b-second',
    });

    const allRecords = await service.getAuditLogs();
    expect(ComplianceAuditLogEntity.verifyChain(allRecords)).toBe(true);
    expect(tenantASecond.previousHash).toBe(tenantAFirst.chainedHash);
    expect((await service.verifyIntegrity('tenant-a')).valid).toBe(true);
    expect((await service.verifyIntegrity('tenant-b')).valid).toBe(true);
  });

  it('detects tail truncation against the known tenant hash', async () => {
    await service.recordAudit({
      tenantId: 'tenant-tail',
      action: 'FIRST',
      documentHash: 'first',
    });
    const last = await service.recordAudit({
      tenantId: 'tenant-tail',
      action: 'SECOND',
      documentHash: 'second',
    });
    const before = await service.verifyIntegrity('tenant-tail');
    const memoryLog = (
      service as unknown as { memoryLog: ComplianceAuditLogEntity[] }
    ).memoryLog;
    memoryLog.pop();
    const after = await service.verifyIntegrity('tenant-tail');

    expect(before.lastHash).toBe(last.chainedHash);
    expect(after.valid).toBe(false);
    expect(after.lastHash).toBe(before.lastHash);
  });

  it('detects tampering in audit log chain', async () => {
    await service.recordAudit({
      tenantId: 'tenant-tamper',
      action: 'ESCROW_CLOSING_STIPULATION',
      documentHash: 'hash-initial',
    });
    await service.recordAudit({
      tenantId: 'tenant-tamper',
      action: 'DISBURSEMENT_SCHEDULE',
      documentHash: 'hash-secondary',
    });

    const logs = await service.getAuditLogs('tenant-tamper');
    expect(ComplianceAuditLogEntity.verifyChain(logs)).toBe(true);

    const tamperedLogs = [
      { ...logs[0], documentHash: 'altered-document-hash' },
      logs[1],
    ];
    expect(ComplianceAuditLogEntity.verifyChain(tamperedLogs)).toBe(false);
  });

  it('does not store raw query strings in fallback audit metadata', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'SAFE_PATH',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          tenantId: 'query-safe-tenant',
          url: '/documents?token=raw-query-token',
          query: { secret: 'raw-query-secret' },
        }),
      }),
    } as any;

    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of('ok') })
    );

    const [audit] = await service.getAuditLogs('query-safe-tenant');
    expect(audit.fileName).toBe('/documents');
    expect(JSON.stringify(audit.metadata)).not.toContain('raw-query-token');
    expect(JSON.stringify(audit.metadata)).not.toContain('raw-query-secret');
  });

  it('returns the endpoint response unchanged after recording an audit', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'SECURE_TAX_DROP',
      complianceStandard: 'FTC 16 CFR Part 314',
    });

    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const response = { success: true, documentId: 'doc-99' };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          tenantId: 'tenant-law-firm',
          body: { fileName: 'Closing-Package.pdf', fileBase64: 'VGVzdCBkYXRh' },
        }),
      }),
    } as any;
    const result = await firstValueFrom(
      interceptor.intercept(context, { handle: () => of(response) })
    );

    expect(result).toBe(response);
    const [audit] = await service.getAuditLogs('tenant-law-firm');
    expect(audit.action).toBe('SECURE_TAX_DROP');
  });

  it('ignores raw header and body tenant spoofing', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'TENANT_SPOOF_IGNORED',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const request = {
      headers: { 'x-tenant-id': 'header-tenant-spoof' },
      body: { tenantId: 'body-tenant-spoof' },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of({ ok: true }) })
    );

    const [audit] = await service.getAuditLogs();
    expect(audit.tenantId).toBe('system');
  });

  it('prefers guard-owned tenant context over a conflicting request id and header', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'GUARD_TENANT_CONTEXT',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const request = {
      tenantId: 'request-tenant-spoof',
      tenantContext: { tenantId: 'guard-tenant' },
      headers: { 'x-tenant-id': 'header-tenant-spoof' },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of({ ok: true }) })
    );

    const [audit] = await service.getAuditLogs('guard-tenant');
    expect(audit.tenantId).toBe('guard-tenant');
  });

  it('uses authenticated user tenant identity when guard context is absent', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'AUTHENTICATED_TENANT',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const request = {
      user: { tenantId: 'authenticated-tenant' },
      headers: { 'x-tenant-id': 'header-tenant-spoof' },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of({ ok: true }) })
    );

    const [audit] = await service.getAuditLogs();
    expect(audit.tenantId).toBe('authenticated-tenant');
  });

  it('uses only the authenticated request identity for actor metadata', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'AUTHENTICATED_ACTOR',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const response = {
      documentId: 'authenticated-actor-document',
      actorId: 'response-actor-spoof',
    };
    const request = {
      tenantId: 'authenticated-actor-tenant',
      actorId: 'request-actor-spoof',
      body: { actorId: 'body-actor-spoof' },
      user: { id: 'authenticated-actor' },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    const result = await firstValueFrom(
      interceptor.intercept(context, { handle: () => of(response) })
    );
    const [audit] = await service.getAuditLogs('authenticated-actor-tenant');

    expect(result).toBe(response);
    expect(audit.metadata['actorId']).toBe('authenticated-actor');
    expect(JSON.stringify(audit.metadata)).not.toContain('actor-spoof');
  });

  it('uses an anonymous actor when no authenticated identity is present', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'ANONYMOUS_ACTOR',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const request = {
      tenantId: 'anonymous-actor-tenant',
      body: { actorId: 'body-actor-spoof' },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ actorId: 'response-actor-spoof' }),
      })
    );
    const [audit] = await service.getAuditLogs('anonymous-actor-tenant');

    expect(audit.metadata['actorId']).toBe('anonymous');
    expect(JSON.stringify(audit.metadata)).not.toContain('actor-spoof');
  });

  it('ignores spoofed document hash fields and hashes actual file bytes', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'HASH_FILE_BYTES',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const fileBytes = Buffer.from('actual uploaded file');
    const request = {
      tenantId: 'hash-file-tenant',
      headers: { 'x-document-hash': 'spoofed-header-hash' },
      file: { buffer: fileBytes },
      body: { documentHash: 'spoofed-body-hash' },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ documentHash: 'spoofed-response-hash' }),
      })
    );
    const [audit] = await service.getAuditLogs('hash-file-tenant');

    expect(audit.documentHash).toBe(
      crypto.createHash('sha256').update(fileBytes).digest('hex')
    );
    expect(audit.documentHash).not.toContain('spoofed');
  });

  it('ignores spoofed document hash fields and hashes actual base64 bytes', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'HASH_BASE64_BYTES',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const fileBytes = Buffer.from('actual base64 upload');
    const request = {
      tenantId: 'hash-base64-tenant',
      headers: { 'x-document-hash': 'spoofed-header-hash' },
      body: { fileBase64: fileBytes.toString('base64') },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ documentHash: 'spoofed-response-hash' }),
      })
    );
    const [audit] = await service.getAuditLogs('hash-base64-tenant');

    expect(audit.documentHash).toBe(
      crypto.createHash('sha256').update(fileBytes).digest('hex')
    );
  });

  it('hashes response bytes when no request file is present', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'HASH_RESPONSE_BYTES',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const responseBytes = Buffer.from('actual response bytes');
    const request = {
      tenantId: 'hash-response-tenant',
      headers: { 'x-document-hash': 'spoofed-header-hash' },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of(responseBytes) })
    );
    const [audit] = await service.getAuditLogs('hash-response-tenant');

    expect(audit.documentHash).toBe(
      crypto.createHash('sha256').update(responseBytes).digest('hex')
    );
  });

  it('uses safe actual request and response metadata without changing the response', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'METADATA_EVENT',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const response = {
      documentId: 'document-42',
      fileName: 'return.pdf',
      documentHash: 'response-document-hash',
      antivirusStatus: 'clean',
      actorId: 'response-actor-spoof',
      subjectId: 'subject-42',
      value: 'unchanged',
    };
    const request = {
      method: 'POST',
      tenantId: 'fallback-tenant',
      tenantContext: { tenantId: 'context-tenant' },
      user: { id: 'actor-42' },
      actorId: 'request-actor-spoof',
      subjectId: 'request-subject',
      antivirusStatus: 'infected',
      query: { token: 'raw-query-token' },
      body: {
        token: 'must-not-be-recorded',
        actorId: 'body-actor-spoof',
        fileBase64: Buffer.from('actual request bytes').toString('base64'),
      },
    };

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;

    const result = await firstValueFrom(
      interceptor.intercept(context, { handle: () => of(response) })
    );

    expect(result).toBe(response);
    const [audit] = await service.getAuditLogs('context-tenant');
    expect(audit.documentId).toBe('document-42');
    expect(audit.fileName).toBe('return.pdf');
    expect(audit.documentHash).toBe(
      crypto
        .createHash('sha256')
        .update(Buffer.from('actual request bytes'))
        .digest('hex')
    );
    expect(audit.antivirusStatus).toBe('infected');
    expect(audit.metadata).toMatchObject({
      outcome: 'success',
      method: 'POST',
      actorId: 'actor-42',
      subjectId: 'subject-42',
    });
    expect(JSON.stringify(audit.metadata)).not.toContain(
      'must-not-be-recorded'
    );
    expect(JSON.stringify(audit.metadata)).not.toContain('raw-query-token');
    expect(JSON.stringify(audit.metadata)).not.toContain('raw-body');
  });

  it('propagates successful audit append failures without recording a failure event', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'SUCCESS_AUDIT_FAILURE',
    });
    const auditError = new Error('audit append failed');
    const entries: Array<Record<string, unknown>> = [];
    const recordAudit = jest.fn(async (entry: Record<string, unknown>) => {
      entries.push(entry);
      throw auditError;
    });
    const auditService = { recordAudit } as unknown as ComplianceAuditService;
    const interceptor = new ComplianceAuditInterceptor(reflector, auditService);
    const response = {
      documentId: 'successful-document',
      actorId: 'successful-actor',
      subjectId: 'successful-subject',
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          tenantId: 'successful-audit-tenant',
          user: { id: 'successful-actor' },
        }),
      }),
    } as any;

    await expect(
      firstValueFrom(
        interceptor.intercept(context, { handle: () => of(response) })
      )
    ).rejects.toBe(auditError);
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(entries[0]['metadata']).toMatchObject({
      outcome: 'success',
      actorId: 'successful-actor',
      subjectId: 'successful-subject',
    });
  });

  it('rethrows the original handler error when failure audit append fails', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'HANDLER_AUDIT_FAILURE',
    });
    const originalError = new Error('original handler failure');
    const auditError = new Error('failure audit append failed');
    const recordAudit = jest.fn().mockRejectedValue(auditError);
    const auditService = { recordAudit } as unknown as ComplianceAuditService;
    const interceptor = new ComplianceAuditInterceptor(reflector, auditService);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ tenantId: 'handler-audit-tenant' }),
      }),
    } as any;

    await expect(
      firstValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => originalError),
        })
      )
    ).rejects.toBe(originalError);
    expect(recordAudit).toHaveBeenCalledTimes(1);
  });

  it('preserves object, array, Buffer, Date, and primitive responses', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'RESPONSE_IDENTITY',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ tenantId: 'tenant-response' }),
      }),
    } as any;
    const values: unknown[] = [
      { value: 1 },
      [1, 2, 3],
      Buffer.from('response'),
      new Date('2026-09-24T12:00:00.000Z'),
      'primitive',
      42,
      false,
    ];

    for (const value of values) {
      const result = await firstValueFrom(
        interceptor.intercept(context, { handle: () => of(value) })
      );
      expect(result).toBe(value);
    }
  });

  it('fails closed when the audit service is unavailable', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'MISSING_AUDIT_SERVICE',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, undefined);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ tenantId: 'tenant-missing-service' }),
      }),
    } as any;

    await expect(
      firstValueFrom(interceptor.intercept(context, { handle: () => of('ok') }))
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('records a safe failure event and rethrows the original error', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: 'FAILURE_EVENT',
    });
    const interceptor = new ComplianceAuditInterceptor(reflector, service);
    const originalError = new Error('original failure with secret details');
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          tenantId: 'tenant-failure',
          body: { token: 'raw-token', accountNumber: 'bank-account' },
          query: { secret: 'raw-query-secret' },
        }),
      }),
    } as any;

    await expect(
      firstValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => originalError),
        })
      )
    ).rejects.toBe(originalError);
    const [failure] = await service.getAuditLogs('tenant-failure');
    expect(failure.action).toBe('FAILURE_EVENT:FAILURE');
    const safeEvent = JSON.stringify(failure.metadata);
    expect(safeEvent).not.toContain('raw-token');
    expect(safeEvent).not.toContain('bank-account');
    expect(safeEvent).not.toContain('raw-query-secret');
    expect(safeEvent).not.toContain('original failure');
  });
});

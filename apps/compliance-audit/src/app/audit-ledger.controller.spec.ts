import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { ComplianceAuditLogEntity } from '@optimistic-tanuki/business-security';
import { createHash } from 'crypto';
import { AuditLedgerController } from './audit-ledger.controller';
import { AuditLedgerService } from './audit-ledger.service';
import {
  VAULT_APPEND_AUDIT_EVENT,
  VAULT_EXPORT_WISP_AUDIT,
  VAULT_GET_WISP_AUDIT,
  VAULT_LIST_AUDIT_EVENTS,
  VAULT_VERIFY_AUDIT_CHAIN,
} from '@optimistic-tanuki/constants';

describe('AuditLedgerController', () => {
  let controller: AuditLedgerController;
  let ledger: {
    append: jest.Mock;
    list: jest.Mock;
    page: jest.Mock;
    verify: jest.Mock;
    wispReport: jest.Mock;
    exportWispAudit: jest.Mock;
  };

  const documentHash = createHash('sha256').update('doc').digest('hex');

  const record = (overrides: Partial<ComplianceAuditLogEntity> = {}) =>
    ({
      id: 'audit-1',
      tenantId: 'tenant-a',
      action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
      documentId: 'doc-1',
      fileName: 'doc.pdf',
      documentHash,
      previousHash: '0'.repeat(64),
      chainedHash: 'a'.repeat(64),
      antivirusStatus: 'clean',
      complianceStandard: 'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557',
      metadata: {},
      timestamp: '2026-09-25T12:00:00.000Z',
      ...overrides,
    } as ComplianceAuditLogEntity);

  beforeEach(async () => {
    ledger = {
      append: jest.fn().mockResolvedValue(record()),
      list: jest.fn().mockResolvedValue({
        records: [record()],
        page: 1,
        limit: 100,
        totalRecords: 1,
      }),
      page: jest.fn().mockResolvedValue({
        records: [record()],
        tenantId: 'tenant-a',
        page: 1,
        limit: 100,
        totalRecords: 1,
        chainValid: true,
        complianceStandard: 'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557',
        generatedAt: '2026-09-25T12:00:00.000Z',
      }),
      verify: jest.fn().mockResolvedValue({
        tenantId: 'tenant-a',
        valid: true,
        totalRecords: 1,
        lastHash: 'a'.repeat(64),
        firstBrokenIndex: null,
      }),
      wispReport: jest.fn().mockResolvedValue({
        records: [],
        chainValid: true,
        totalRecords: 0,
        complianceStandard: 'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557',
        page: 1,
        limit: 100,
        generatedAt: '2026-09-25T12:00:00.000Z',
      }),
      exportWispAudit: jest.fn().mockResolvedValue({
        format: 'json',
        tenantId: 'tenant-a',
        generatedAt: '2026-09-25T12:00:00.000Z',
        totalRecords: 0,
        exportedRecords: 0,
        maxRecords: 10000,
        truncated: false,
        chainValid: true,
        exportedChainValid: true,
        fullChainValid: true,
        firstBrokenIndex: null,
        exportedFirstBrokenIndex: null,
        records: [],
        content: '{}',
        contentType: 'application/json; charset=utf-8',
        filename: 'wisp-compliance-audit-tenant-a.json',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLedgerController],
      providers: [
        {
          provide: AuditLedgerService,
          useValue: ledger,
        },
      ],
    }).compile();

    controller = module.get<AuditLedgerController>(AuditLedgerController);
  });

  it('exposes the documented TCP message patterns', () => {
    const patternFor = (
      method: 'append' | 'list' | 'wisp' | 'verify' | 'exportWisp'
    ) =>
      Reflect.getMetadata(
        PATTERN_METADATA,
        AuditLedgerController.prototype[method]
      );

    expect(patternFor('append')).toEqual([VAULT_APPEND_AUDIT_EVENT]);
    expect(patternFor('list')).toEqual([VAULT_LIST_AUDIT_EVENTS]);
    expect(patternFor('wisp')).toEqual([VAULT_GET_WISP_AUDIT]);
    expect(patternFor('verify')).toEqual([VAULT_VERIFY_AUDIT_CHAIN]);
    expect(patternFor('exportWisp')).toEqual([VAULT_EXPORT_WISP_AUDIT]);
  });

  it('forwards an append payload to the ledger unchanged', async () => {
    const payload = {
      tenantId: 'tenant-a',
      action: 'ESCROW_WIRE_REVEALED',
      documentId: 'escrow-1',
      fileName: 'Escrow-Wire-CLOSING-1.json',
      documentHash,
      antivirusStatus: 'not_scanned',
      complianceStandard: 'ALTA Pillar 3 Wire Fraud Defense',
      metadata: { reference: 'CLOSING-1' },
    };

    const result = await controller.append(payload);

    expect(ledger.append).toHaveBeenCalledWith(payload);
    expect(result.chainedHash).toBe('a'.repeat(64));
  });

  it('passes an absent tenant through so the ledger rejects it', async () => {
    await controller.append({
      action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
      documentHash,
    } as never);

    expect(ledger.append).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: undefined })
    );
  });

  it('rejects an append with no tenant context at the controller boundary', async () => {
    const strictLedger = new AuditLedgerService({
      transaction: async () => {
        throw new BadRequestException('should not reach the database');
      },
    } as never);
    const strictController = new AuditLedgerController(strictLedger);

    await expect(
      strictController.append({
        action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
        documentHash,
      } as never)
    ).rejects.toThrow(BadRequestException);
  });

  it.each(['previousHash', 'chainedHash', 'timestamp', 'id'])(
    'rejects a caller-supplied %s instead of silently dropping it',
    async (field) => {
      const strictLedger = new AuditLedgerService({
        transaction: async () => {
          throw new BadRequestException('should not reach the database');
        },
      } as never);
      const strictController = new AuditLedgerController(strictLedger);

      await expect(
        strictController.append({
          tenantId: 'tenant-a',
          action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
          documentHash,
          [field]:
            field === 'timestamp' ? new Date().toISOString() : 'f'.repeat(64),
        } as never)
      ).rejects.toThrow(BadRequestException);
    }
  );

  it('takes the tenant from the payload, not from a nested body field', async () => {
    await controller.append({
      tenantId: 'tenant-a',
      action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
      documentHash,
      metadata: { tenantId: 'tenant-b' },
    });

    expect(ledger.append).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a' })
    );
  });

  it('scopes a paginated list read to the requested tenant', async () => {
    await controller.list({ tenantId: 'tenant-a', page: 2, limit: 25 });

    expect(ledger.page).toHaveBeenCalledWith('tenant-a', {
      page: 2,
      limit: 25,
    });
  });

  it('never lets a list payload override the tenant it is scoped to', async () => {
    await controller.list({
      tenantId: 'tenant-a',
      page: 1,
      limit: 10,
      offset: 5000,
    } as never);

    expect(ledger.page).toHaveBeenCalledWith('tenant-a', {
      page: 1,
      limit: 10,
    });
  });

  it('scopes the WISP report read to the requested tenant', async () => {
    await controller.wisp({ tenantId: 'tenant-a', page: 3, limit: 50 });

    expect(ledger.wispReport).toHaveBeenCalledWith('tenant-a', {
      page: 3,
      limit: 50,
    });
  });

  it('serves the WISP report from the persistent chain, never from memory', async () => {
    const report = await controller.wisp({ tenantId: 'tenant-a' });

    expect(ledger.wispReport).toHaveBeenCalledWith('tenant-a', {
      page: undefined,
      limit: undefined,
    });
    expect(report.chainValid).toBe(true);
  });

  it('forwards a WISP export request without accepting a record override', async () => {
    const result = await controller.exportWisp({
      tenantId: 'tenant-a',
      format: 'csv',
      maxRecords: 1,
      records: [{ id: 'forged' }],
    } as never);

    expect(ledger.exportWispAudit).toHaveBeenCalledWith('tenant-a', 'csv');
    expect(result.filename).toBe('wisp-compliance-audit-tenant-a.json');
  });

  it('passes an absent format through so the ledger validates it', async () => {
    await controller.exportWisp({ tenantId: 'tenant-a' });

    expect(ledger.exportWispAudit).toHaveBeenCalledWith('tenant-a', undefined);
  });

  it('scopes a chain verification to the requested tenant', async () => {
    const result = await controller.verify({ tenantId: 'tenant-a' });

    expect(ledger.verify).toHaveBeenCalledWith('tenant-a');
    expect(result).toMatchObject({
      tenantId: 'tenant-a',
      valid: true,
      firstBrokenIndex: null,
    });
  });

  it('returns a tampered chain verdict truthfully', async () => {
    ledger.verify.mockResolvedValue({
      tenantId: 'tenant-a',
      valid: false,
      totalRecords: 3,
      lastHash: 'c'.repeat(64),
      firstBrokenIndex: 1,
    });

    await expect(
      controller.verify({ tenantId: 'tenant-a' })
    ).resolves.toMatchObject({ valid: false, firstBrokenIndex: 1 });
  });
});

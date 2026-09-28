import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import {
  ComplianceAuditLogEntity,
  GENESIS_COMPLIANCE_HASH,
  sanitizeTenantId,
  withTenantRlsTransaction,
} from '@optimistic-tanuki/business-security';
import {
  AppendAuditEventDto,
  AuditChainVerificationDto,
  AuditEventPageDto,
  ComplianceAuditAppendInput,
  ComplianceAuditExport,
  ComplianceAuditExportFormat,
  ComplianceAuditExportReport,
  DocumentAuditResponseDto,
  MAX_AUDIT_EVENTS_PAGE_SIZE,
  MAX_AUDIT_EXPORT_RECORDS,
  WISP_COMPLIANCE_STANDARD,
  WispAuditLogDto,
} from '@optimistic-tanuki/models';
import {
  renderComplianceAuditCsv,
  renderComplianceAuditJson,
  toComplianceAuditLogRecord,
} from './audit-ledger-export';

const DOCUMENT_HASH_PATTERN = /^[a-f0-9]{64}$/i;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_VERIFY_WINDOW_SIZE = 1000;
const MAX_VERIFY_WINDOW_SIZE = 5000;

export type AuditChainWindowResult = {
  valid: boolean;
  totalRecords: number;
  lastHash: string;
  lastTimestamp: string | null;
  firstBrokenIndex: number | null;
};

export type AuditLedgerPage = {
  records: ComplianceAuditLogEntity[];
  page: number;
  limit: number;
  totalRecords: number;
};

@Injectable()
export class AuditLedgerService {
  private readonly logger = new Logger(AuditLedgerService.name);

  constructor(
    @Inject('COMPLIANCE_AUDIT_CONNECTION')
    private readonly dataSource: DataSource
  ) {}

  /**
   * Appends one event to a tenant's chain. The tail read, the `previousHash`
   * derivation and the insert all happen inside one transaction that holds a
   * per-tenant advisory lock for its duration, so two concurrent appends for
   * the same tenant serialize instead of forking the chain. The chain fields
   * are computed here and are never accepted from a caller.
   */
  async append(
    input: ComplianceAuditAppendInput
  ): Promise<ComplianceAuditLogEntity> {
    const tenantId = this.requireTenantId(input?.tenantId);
    // Validated with `forbidNonWhitelisted`, so a payload carrying
    // `previousHash`, `chainedHash`, `timestamp` or any other chain field is
    // rejected outright rather than quietly overwritten.
    const { tenantId: _tenantId, ...body } = input as Record<string, unknown>;
    const dto = await this.validateDto(AppendAuditEventDto, body);
    this.assertDocumentHash(dto.documentHash);

    const record = await this.transact(tenantId, async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        tenantId,
      ]);

      const tail = await this.readTail(manager, tenantId);
      const timestamp = this.nextTimestamp(tail);
      const complianceStandard =
        dto.complianceStandard || WISP_COMPLIANCE_STANDARD;
      const created = manager.getRepository(ComplianceAuditLogEntity).create({
        tenantId,
        action: dto.action,
        documentId: dto.documentId,
        fileName: dto.fileName ?? 'document.dat',
        documentHash: dto.documentHash.toLowerCase(),
        previousHash: tail?.chainedHash ?? GENESIS_COMPLIANCE_HASH,
        chainedHash: '',
        antivirusStatus: dto.antivirusStatus || 'not_scanned',
        complianceStandard,
        metadata: dto.metadata ?? {},
        timestamp: timestamp.toISOString(),
      });
      const saved = await manager
        .getRepository(ComplianceAuditLogEntity)
        .save(created);
      saved.chainedHash = ComplianceAuditLogEntity.computeChainedHash(
        ComplianceAuditLogEntity.canonicalFields(saved)
      );
      await manager
        .getRepository(ComplianceAuditLogEntity)
        .update(saved.id, { chainedHash: saved.chainedHash });
      return saved;
    });

    this.logger.log(
      `Recorded compliance audit event ${
        record.id
      } for tenant ${tenantId}. Chained SHA-256: ${record.chainedHash.substring(
        0,
        12
      )}...`
    );

    return record;
  }

  async list(
    tenantId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<AuditLedgerPage> {
    const safeTenantId = this.requireTenantId(tenantId);
    const page = this.normalizePage(options.page);
    const limit = this.normalizeLimit(options.limit);

    return this.transact(safeTenantId, async (manager) => {
      const repository = manager.getRepository(ComplianceAuditLogEntity);
      const [records, totalRecords] = await Promise.all([
        repository.find({
          where: { tenantId: safeTenantId },
          order: { timestamp: 'ASC' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        repository.count({ where: { tenantId: safeTenantId } }),
      ]);

      return { records, page, limit, totalRecords };
    });
  }

  async verify(
    tenantId: string,
    windowSize = DEFAULT_VERIFY_WINDOW_SIZE
  ): Promise<AuditChainVerificationDto> {
    const safeTenantId = this.requireTenantId(tenantId);

    return this.transact(safeTenantId, async (manager) => {
      const result = await this.verifyChainWindowed(
        manager,
        safeTenantId,
        windowSize
      );
      return {
        tenantId: safeTenantId,
        valid: result.valid,
        totalRecords: result.totalRecords,
        lastHash: result.lastHash,
        firstBrokenIndex: result.firstBrokenIndex,
      };
    });
  }

  /**
   * Tenant chain read shaped for the WISP compliance report. Chain validity is
   * recomputed over the full tenant chain, never the returned page, so a
   * tampered record outside the page still fails the report.
   */
  async page(
    tenantId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<AuditEventPageDto> {
    const safeTenantId = this.requireTenantId(tenantId);
    const [read, verification] = await Promise.all([
      this.list(safeTenantId, options),
      this.verify(safeTenantId),
    ]);

    return {
      records: read.records.map((record) => this.toAuditResponse(record)),
      tenantId: safeTenantId,
      page: read.page,
      limit: read.limit,
      totalRecords: read.totalRecords,
      chainValid: verification.valid,
      complianceStandard: WISP_COMPLIANCE_STANDARD,
      generatedAt: new Date().toISOString(),
    };
  }

  async wispReport(
    tenantId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<WispAuditLogDto> {
    const report = await this.page(tenantId, options);

    return {
      records: report.records,
      chainValid: report.chainValid,
      totalRecords: report.totalRecords,
      complianceStandard: report.complianceStandard,
      page: report.page,
      limit: report.limit,
      generatedAt: report.generatedAt,
    };
  }

  async exportWispAudit(
    tenantId: string,
    format: unknown,
    options: { maxRecords?: number } = {}
  ): Promise<ComplianceAuditExport> {
    const safeTenantId = this.requireTenantId(tenantId);
    const safeFormat = this.normalizeExportFormat(format);
    const maxRecords = this.normalizeExportMaxRecords(options.maxRecords);

    return this.transact(safeTenantId, async (manager) => {
      const repository = manager.getRepository(ComplianceAuditLogEntity);
      const [exportedRecords, totalRecords, chain] = await Promise.all([
        repository.find({
          where: { tenantId: safeTenantId },
          order: { timestamp: 'ASC', id: 'ASC' },
          take: maxRecords,
        }),
        repository.count({ where: { tenantId: safeTenantId } }),
        this.verifyChainWindowed(
          manager,
          safeTenantId,
          DEFAULT_VERIFY_WINDOW_SIZE
        ),
      ]);
      const total = totalRecords;
      const truncated = total > exportedRecords.length;
      const fullChainValid = chain.valid;
      const exportedChainValid = this.verifyChain(exportedRecords);
      const report: ComplianceAuditExportReport = {
        format: safeFormat,
        tenantId: safeTenantId,
        generatedAt: chain.lastTimestamp ?? '1970-01-01T00:00:00.000Z',
        totalRecords: total,
        exportedRecords: exportedRecords.length,
        maxRecords,
        truncated,
        chainValid: fullChainValid && exportedChainValid && !truncated,
        exportedChainValid,
        fullChainValid,
        firstBrokenIndex: chain.firstBrokenIndex,
        exportedFirstBrokenIndex: exportedChainValid
          ? null
          : this.findFirstBrokenIndex(exportedRecords),
        records: exportedRecords.map(toComplianceAuditLogRecord),
      };
      const content =
        safeFormat === 'csv'
          ? renderComplianceAuditCsv(report)
          : renderComplianceAuditJson(report);
      const extension = safeFormat === 'csv' ? 'csv' : 'json';
      const filename = `wisp-compliance-audit-${safeTenantId}.${extension}`;

      return {
        ...report,
        contentType:
          safeFormat === 'csv'
            ? 'text/csv; charset=utf-8'
            : 'application/json; charset=utf-8',
        filename,
        content,
      };
    });
  }

  private toAuditResponse(
    record: ComplianceAuditLogEntity
  ): DocumentAuditResponseDto {
    const antivirusStatus =
      record.antivirusStatus === 'clean' ||
      record.antivirusStatus === 'infected'
        ? record.antivirusStatus
        : 'skipped';

    return {
      id: record.id,
      tenantId: record.tenantId,
      documentId: record.documentId,
      fileName: record.fileName,
      documentHash: record.documentHash,
      previousHash: record.previousHash,
      chainedHash: record.chainedHash,
      antivirusStatus,
      complianceStandard: record.complianceStandard,
      wispCompliant: antivirusStatus === 'clean',
      timestamp: record.timestamp,
      scannedAt: record.timestamp,
    };
  }

  private async readTail(
    manager: EntityManager,
    tenantId: string
  ): Promise<ComplianceAuditLogEntity | null> {
    return manager
      .getRepository(ComplianceAuditLogEntity)
      .findOne({ where: { tenantId }, order: { timestamp: 'DESC' } });
  }

  /**
   * The chain order is the `timestamp` order, so an append must never land on
   * or before its predecessor's timestamp. Same-millisecond appends are pushed
   * forward by one millisecond, which keeps the ordering total without
   * changing anything that is already stored.
   */
  private nextTimestamp(tail: ComplianceAuditLogEntity | null): Date {
    const now = Date.now();
    if (!tail) {
      return new Date(now);
    }
    const tailMs = new Date(tail.timestamp).getTime();
    return new Date(Number.isFinite(tailMs) ? Math.max(now, tailMs + 1) : now);
  }

  private verifyChain(records: ComplianceAuditLogEntity[]): boolean {
    try {
      return ComplianceAuditLogEntity.verifyChain(records);
    } catch {
      return false;
    }
  }

  /**
   * Streams a tenant's chain in fixed-size windows instead of loading every
   * row at once. Hash continuity is sequential, so a window only needs the
   * previous window's tail hash plus its own rows to prove the same property
   * the full-load verifier proves. Stops at the first break.
   */
  private async verifyChainWindowed(
    manager: EntityManager,
    tenantId: string,
    windowSize: number
  ): Promise<AuditChainWindowResult> {
    const take =
      Number.isSafeInteger(windowSize) && windowSize > 0
        ? Math.min(windowSize, MAX_VERIFY_WINDOW_SIZE)
        : DEFAULT_VERIFY_WINDOW_SIZE;
    const repository = manager.getRepository(ComplianceAuditLogEntity);
    let expectedPrevious = GENESIS_COMPLIANCE_HASH;
    let globalIndex = 0;
    let lastHash = GENESIS_COMPLIANCE_HASH;
    let lastTimestamp: string | null = null;

    for (let skip = 0; ; skip += take) {
      const window = await repository.find({
        where: { tenantId },
        order: { timestamp: 'ASC', id: 'ASC' },
        skip,
        take,
      });
      if (window.length === 0) {
        break;
      }
      for (const current of window) {
        if (
          !current ||
          typeof current.previousHash !== 'string' ||
          current.previousHash !== expectedPrevious
        ) {
          return {
            valid: false,
            totalRecords: await repository.count({ where: { tenantId } }),
            lastHash,
            lastTimestamp,
            firstBrokenIndex: globalIndex,
          };
        }
        let recomputed: string;
        try {
          recomputed = ComplianceAuditLogEntity.computeChainedHash(
            ComplianceAuditLogEntity.canonicalFields(current)
          );
        } catch {
          return {
            valid: false,
            totalRecords: await repository.count({ where: { tenantId } }),
            lastHash,
            lastTimestamp,
            firstBrokenIndex: globalIndex,
          };
        }
        if (recomputed !== current.chainedHash) {
          return {
            valid: false,
            totalRecords: await repository.count({ where: { tenantId } }),
            lastHash,
            lastTimestamp,
            firstBrokenIndex: globalIndex,
          };
        }
        expectedPrevious = current.chainedHash;
        lastHash = current.chainedHash;
        lastTimestamp =
          typeof current.timestamp === 'string'
            ? current.timestamp
            : new Date(current.timestamp).toISOString();
        globalIndex += 1;
      }
      if (window.length < take) {
        break;
      }
    }

    return {
      valid: true,
      totalRecords: globalIndex,
      lastHash,
      lastTimestamp,
      firstBrokenIndex: null,
    };
  }

  private findFirstBrokenIndex(
    records: ComplianceAuditLogEntity[]
  ): number | null {
    if (records.length === 0) {
      return null;
    }

    for (let index = 0; index < records.length; index += 1) {
      const current = records[index];
      if (!current || typeof current.previousHash !== 'string') {
        return index;
      }
      const expectedPrevious =
        index === 0 ? GENESIS_COMPLIANCE_HASH : records[index - 1].chainedHash;
      if (current.previousHash !== expectedPrevious) {
        return index;
      }
      try {
        const recomputed = ComplianceAuditLogEntity.computeChainedHash(
          ComplianceAuditLogEntity.canonicalFields(current)
        );
        if (recomputed !== current.chainedHash) {
          return index;
        }
      } catch {
        return index;
      }
    }

    return null;
  }

  private transact<T>(
    tenantId: string,
    operation: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    return withTenantRlsTransaction(this.dataSource, tenantId, (manager) =>
      operation(manager as unknown as EntityManager)
    );
  }

  private requireTenantId(tenantId: unknown): string {
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new BadRequestException('Tenant context is required');
    }
    try {
      return sanitizeTenantId(tenantId);
    } catch {
      throw new BadRequestException('Tenant context is required');
    }
  }

  private assertDocumentHash(documentHash: string): void {
    if (!DOCUMENT_HASH_PATTERN.test(documentHash)) {
      throw new BadRequestException(
        'A 64-character SHA-256 document hash is required'
      );
    }
  }

  private normalizePage(page: number | undefined): number {
    if (page === undefined) {
      return DEFAULT_PAGE;
    }
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new BadRequestException('page must be a positive integer');
    }
    return page;
  }

  private normalizeLimit(limit: number | undefined): number {
    if (limit === undefined) {
      return DEFAULT_PAGE_SIZE;
    }
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_AUDIT_EVENTS_PAGE_SIZE
    ) {
      throw new BadRequestException(
        `limit must be an integer between 1 and ${MAX_AUDIT_EVENTS_PAGE_SIZE}`
      );
    }
    return limit;
  }

  private normalizeExportFormat(format: unknown): ComplianceAuditExportFormat {
    if (format === undefined || format === null || format === '') {
      return 'csv';
    }
    if (format !== 'csv' && format !== 'json') {
      throw new BadRequestException('format must be csv or json');
    }
    return format;
  }

  private normalizeExportMaxRecords(maxRecords: number | undefined): number {
    if (maxRecords === undefined) {
      return MAX_AUDIT_EXPORT_RECORDS;
    }
    if (
      !Number.isSafeInteger(maxRecords) ||
      maxRecords < 1 ||
      maxRecords > MAX_AUDIT_EXPORT_RECORDS
    ) {
      throw new BadRequestException(
        `maxRecords must be an integer between 1 and ${MAX_AUDIT_EXPORT_RECORDS}`
      );
    }
    return maxRecords;
  }

  private async validateDto<T extends object>(
    type: new () => T,
    value: unknown
  ): Promise<T> {
    const instance = plainToInstance(type, value);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new BadRequestException('Invalid compliance audit payload');
    }
    return instance;
  }
}

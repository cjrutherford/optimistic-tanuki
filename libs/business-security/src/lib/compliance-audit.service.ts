import {
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ComplianceAuditLogEntity,
  GENESIS_COMPLIANCE_HASH,
} from './compliance-audit-log.entity';

export const COMPLIANCE_AUDIT_OPTIONS = 'COMPLIANCE_AUDIT_OPTIONS';
export const DEFAULT_MAX_COMPLIANCE_AUDIT_RECORDS = 10000;
export const DEFAULT_MAX_COMPLIANCE_AUDIT_RECORDS_PER_TENANT = 1000;

export interface ComplianceAuditServiceOptions {
  maxRecords?: number;
  maxRecordsPerTenant?: number;
}

function normalizeLimit(
  value: number | undefined,
  fallback: number,
  name: string
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function freezeSnapshot(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength
    );
    const type = Buffer.isBuffer(value)
      ? 'Buffer'
      : value.constructor?.name || 'TypedArray';
    return Object.freeze({
      type,
      encoding: 'base64',
      data: Buffer.from(bytes).toString('base64'),
    });
  }
  if (value instanceof ArrayBuffer) {
    return Object.freeze({
      type: 'ArrayBuffer',
      encoding: 'base64',
      data: Buffer.from(new Uint8Array(value)).toString('base64'),
    });
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeSnapshot(item)));
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const snapshot = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(source).sort()) {
      snapshot[key] = freezeSnapshot(source[key]);
    }
    return Object.freeze(snapshot);
  }
  return value;
}

export interface CreateAuditEntryInput {
  tenantId: string;
  action: string;
  documentId?: string;
  fileName?: string;
  documentHash: string;
  antivirusStatus?: string;
  complianceStandard?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date | string;
}

@Injectable()
export class ComplianceAuditService {
  private readonly logger = new Logger(ComplianceAuditService.name);
  private readonly memoryLog: ComplianceAuditLogEntity[] = [];
  private readonly lastTenantHashes: Map<string, string> = new Map();
  private readonly maxRecords: number;
  private readonly maxRecordsPerTenant: number;

  constructor(
    @Optional()
    @Inject(COMPLIANCE_AUDIT_OPTIONS)
    options?: ComplianceAuditServiceOptions
  ) {
    this.maxRecords = normalizeLimit(
      options?.maxRecords,
      DEFAULT_MAX_COMPLIANCE_AUDIT_RECORDS,
      'maxRecords'
    );
    this.maxRecordsPerTenant = normalizeLimit(
      options?.maxRecordsPerTenant,
      DEFAULT_MAX_COMPLIANCE_AUDIT_RECORDS_PER_TENANT,
      'maxRecordsPerTenant'
    );
  }

  async recordAudit(
    entry: CreateAuditEntryInput
  ): Promise<ComplianceAuditLogEntity> {
    const tenantId = entry.tenantId || 'system';
    this.assertCapacity(tenantId);
    const previousHash =
      this.lastTenantHashes.get(tenantId) || GENESIS_COMPLIANCE_HASH;
    const timestamp = this.toIsoTimestamp(entry.timestamp);
    const record = new ComplianceAuditLogEntity();
    record.id = crypto.randomUUID();
    record.tenantId = tenantId;
    record.action = entry.action;
    record.documentId = entry.documentId || crypto.randomUUID();
    record.fileName = entry.fileName || 'document.dat';
    record.documentHash = entry.documentHash;
    record.previousHash = previousHash;
    record.antivirusStatus = entry.antivirusStatus || 'not_scanned';
    record.complianceStandard =
      entry.complianceStandard ||
      'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557';
    record.metadata = freezeSnapshot(entry.metadata || {}) as Record<
      string,
      unknown
    >;
    record.timestamp = timestamp;
    record.chainedHash = ComplianceAuditLogEntity.computeChainedHash(
      ComplianceAuditLogEntity.canonicalFields(record)
    );

    Object.freeze(record);
    this.lastTenantHashes.set(tenantId, record.chainedHash);
    this.memoryLog.push(record);

    this.logger.log(
      `Recorded compliance audit log ${
        record.id
      }. Chained SHA-256: ${record.chainedHash.substring(0, 12)}...`
    );

    return record;
  }

  async getAuditLogs(tenantId?: string): Promise<ComplianceAuditLogEntity[]> {
    if (tenantId) {
      return Object.freeze(
        this.memoryLog.filter((log) => log.tenantId === tenantId)
      ) as ComplianceAuditLogEntity[];
    }
    return Object.freeze([...this.memoryLog]) as ComplianceAuditLogEntity[];
  }

  async verifyIntegrity(tenantId?: string): Promise<{
    valid: boolean;
    totalRecords: number;
    lastHash: string;
  }> {
    const logs = await this.getAuditLogs(tenantId);
    const chainValid = ComplianceAuditLogEntity.verifyChain(logs);
    const lastHash = tenantId
      ? this.lastTenantHashes.get(tenantId) || GENESIS_COMPLIANCE_HASH
      : logs.length > 0
      ? logs[logs.length - 1].chainedHash
      : GENESIS_COMPLIANCE_HASH;
    const tailValid = tenantId
      ? (logs.length > 0
          ? logs[logs.length - 1].chainedHash
          : GENESIS_COMPLIANCE_HASH) === lastHash
      : this.hasKnownTenantTails(logs);

    return {
      valid: chainValid && tailValid,
      totalRecords: logs.length,
      lastHash,
    };
  }

  private assertCapacity(tenantId: string): void {
    if (this.memoryLog.length >= this.maxRecords) {
      throw new ServiceUnavailableException('Audit log total capacity reached');
    }

    let tenantRecords = 0;
    for (const record of this.memoryLog) {
      if (record.tenantId === tenantId) {
        tenantRecords += 1;
      }
    }
    if (tenantRecords >= this.maxRecordsPerTenant) {
      throw new ServiceUnavailableException(
        'Audit log tenant capacity reached'
      );
    }
  }

  private toIsoTimestamp(value: Date | string | undefined): string {
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime())
        ? new Date().toISOString()
        : parsed.toISOString();
    }
    return value
      ? new Date(value.getTime()).toISOString()
      : new Date().toISOString();
  }

  clear(): void {
    this.memoryLog.length = 0;
  }

  reset(): void {
    this.memoryLog.length = 0;
    this.lastTenantHashes.clear();
  }

  private hasKnownTenantTails(logs: ComplianceAuditLogEntity[]): boolean {
    const actualTails = new Map<string, string>();
    for (const log of logs) {
      actualTails.set(log.tenantId, log.chainedHash);
    }
    for (const [tenantId, knownHash] of this.lastTenantHashes) {
      if (
        (actualTails.get(tenantId) || GENESIS_COMPLIANCE_HASH) !== knownHash
      ) {
        return false;
      }
    }
    return true;
  }
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import * as crypto from 'crypto';

export const GENESIS_COMPLIANCE_HASH = '0'.repeat(64);

export interface ComplianceAuditCanonicalFields {
  id: string;
  action: string;
  documentId: string;
  fileName: string;
  documentHash: string;
  antivirusStatus: string;
  complianceStandard: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  tenantId: string;
  previousHash: string;
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(source).sort()) {
      result[key] = canonicalize(source[key]);
    }
    return result;
  }
  return value;
}

@Entity('compliance_audit_logs')
export class ComplianceAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'varchar', length: 128 })
  action: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  documentId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string;

  @Column({ type: 'varchar', length: 64 })
  documentHash: string;

  @Column({ type: 'varchar', length: 64 })
  previousHash: string;

  @Column({ type: 'varchar', length: 64 })
  chainedHash: string;

  @Column({ type: 'varchar', length: 64, default: 'not_scanned' })
  antivirusStatus: string;

  @Column({
    type: 'varchar',
    length: 255,
    default: 'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557',
  })
  complianceStandard: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  timestamp: string;

  static canonicalFields(
    record: ComplianceAuditLogEntity
  ): ComplianceAuditCanonicalFields {
    return {
      id: record.id,
      action: record.action,
      documentId: record.documentId,
      fileName: record.fileName,
      documentHash: record.documentHash,
      antivirusStatus: record.antivirusStatus,
      complianceStandard: record.complianceStandard,
      metadata: record.metadata || {},
      timestamp:
        typeof record.timestamp === 'string'
          ? record.timestamp
          : new Date(record.timestamp).toISOString(),
      tenantId: record.tenantId,
      previousHash: record.previousHash,
    };
  }

  static computeChainedHash(fields: ComplianceAuditCanonicalFields): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalize(fields)))
      .digest('hex');
  }

  static verifyChain(records: ComplianceAuditLogEntity[]): boolean {
    if (!records || records.length === 0) {
      return true;
    }

    const recordsByTenant = new Map<string, ComplianceAuditLogEntity[]>();
    for (const record of records) {
      if (!record || typeof record.tenantId !== 'string') {
        return false;
      }
      const tenantRecords = recordsByTenant.get(record.tenantId) || [];
      tenantRecords.push(record);
      recordsByTenant.set(record.tenantId, tenantRecords);
    }

    for (const tenantRecords of recordsByTenant.values()) {
      if (tenantRecords[0].previousHash !== GENESIS_COMPLIANCE_HASH) {
        return false;
      }
      for (let index = 0; index < tenantRecords.length; index += 1) {
        const current = tenantRecords[index];
        const expectedPrevious =
          index === 0
            ? GENESIS_COMPLIANCE_HASH
            : tenantRecords[index - 1].chainedHash;
        if (current.previousHash !== expectedPrevious) {
          return false;
        }
        const recomputed = ComplianceAuditLogEntity.computeChainedHash(
          ComplianceAuditLogEntity.canonicalFields(current)
        );
        if (recomputed !== current.chainedHash) {
          return false;
        }
      }
    }

    return true;
  }
}

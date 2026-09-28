import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  VAULT_APPEND_AUDIT_EVENT,
  VAULT_EXPORT_WISP_AUDIT,
  VAULT_GET_WISP_AUDIT,
  VAULT_LIST_AUDIT_EVENTS,
  VAULT_VERIFY_AUDIT_CHAIN,
} from '@optimistic-tanuki/constants';
import {
  AuditChainVerificationDto,
  AuditEventPageDto,
  ComplianceAuditAppendInput,
  ComplianceAuditExport,
  ComplianceAuditLogRecord,
  ListAuditEventsDto,
  WispAuditLogDto,
} from '@optimistic-tanuki/models';
import { AuditLedgerService } from './audit-ledger.service';

type TenantPayload = { tenantId?: unknown };

@Controller()
export class AuditLedgerController {
  constructor(private readonly auditLedger: AuditLedgerService) {}

  /**
   * Everything but the tenant reaches the ledger untouched, so a payload that
   * carries a chain field is rejected by the append DTO rather than silently
   * overwritten. The tenant is re-attached from trusted context, never taken
   * from the body.
   */
  @MessagePattern(VAULT_APPEND_AUDIT_EVENT)
  async append(
    @Payload() payload: ComplianceAuditAppendInput
  ): Promise<ComplianceAuditLogRecord> {
    const { tenantId, ...body } = (payload ?? {}) as ComplianceAuditAppendInput;
    return this.auditLedger.append({ ...body, tenantId });
  }

  @MessagePattern(VAULT_LIST_AUDIT_EVENTS)
  async list(
    @Payload() payload: TenantPayload & ListAuditEventsDto
  ): Promise<AuditEventPageDto> {
    return this.auditLedger.page(payload?.tenantId as string, {
      page: payload?.page,
      limit: payload?.limit,
    });
  }

  @MessagePattern(VAULT_GET_WISP_AUDIT)
  async wisp(
    @Payload() payload: TenantPayload & ListAuditEventsDto
  ): Promise<WispAuditLogDto> {
    return this.auditLedger.wispReport(payload?.tenantId as string, {
      page: payload?.page,
      limit: payload?.limit,
    });
  }

  @MessagePattern(VAULT_EXPORT_WISP_AUDIT)
  async exportWisp(
    @Payload() payload: TenantPayload & { format?: unknown }
  ): Promise<ComplianceAuditExport> {
    return this.auditLedger.exportWispAudit(
      payload?.tenantId as string,
      payload?.format
    );
  }

  @MessagePattern(VAULT_VERIFY_AUDIT_CHAIN)
  async verify(
    @Payload() payload: TenantPayload
  ): Promise<AuditChainVerificationDto> {
    return this.auditLedger.verify(payload?.tenantId as string);
  }
}

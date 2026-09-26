import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { ComplianceAuditInterceptor } from './compliance-audit.interceptor';

export const COMPLIANCE_AUDITED_KEY = 'COMPLIANCE_AUDITED';

export interface ComplianceAuditedOptions {
  action?: string;
  complianceStandard?: string;
}

/**
 * Decorates a controller or endpoint for chained SHA-256 tamper-evident compliance audit logging.
 * Satisfies FTC 16 CFR Part 314 and IRS Pub 4557 statutory mandates.
 */
export function ComplianceAudited(
  actionOrOptions?: string | ComplianceAuditedOptions,
  complianceStandard?: string
): MethodDecorator & ClassDecorator {
  const options: ComplianceAuditedOptions =
    typeof actionOrOptions === 'string'
      ? { action: actionOrOptions, complianceStandard }
      : actionOrOptions || {};

  return applyDecorators(
    SetMetadata(COMPLIANCE_AUDITED_KEY, options),
    UseInterceptors(ComplianceAuditInterceptor)
  );
}

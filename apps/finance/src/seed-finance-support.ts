import { FinanceTenant } from './entities/finance-tenant.entity';
import { FinanceTenantMember } from './entities/finance-tenant-member.entity';

export const DEMO_FINANCE_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_FINANCE_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_FINANCE_APP_SCOPE = 'finance';

type FinanceTenantRepo = {
  findOne(args: unknown): Promise<FinanceTenant | null>;
  save(entity: Partial<FinanceTenant>): Promise<FinanceTenant>;
};

type FinanceTenantMemberRepo = {
  findOne(args: unknown): Promise<FinanceTenantMember | null>;
  save(entity: Partial<FinanceTenantMember>): Promise<FinanceTenantMember>;
};

export async function ensureDemoFinanceTenant(
  tenantRepo: FinanceTenantRepo,
  tenantMemberRepo: FinanceTenantMemberRepo
): Promise<{ tenantId: string }> {
  const existingTenant = await tenantRepo.findOne({
    where: { id: DEMO_FINANCE_TENANT_ID },
  });

  if (!existingTenant) {
    await tenantRepo.save({
      id: DEMO_FINANCE_TENANT_ID,
      name: 'Demo Household',
      profileId: DEMO_FINANCE_PROFILE_ID,
      appScope: DEMO_FINANCE_APP_SCOPE,
      isActive: true,
    });
  }

  const existingMember = await tenantMemberRepo.findOne({
    where: {
      tenantId: DEMO_FINANCE_TENANT_ID,
      profileId: DEMO_FINANCE_PROFILE_ID,
    },
  });

  if (!existingMember) {
    await tenantMemberRepo.save({
      tenantId: DEMO_FINANCE_TENANT_ID,
      profileId: DEMO_FINANCE_PROFILE_ID,
      role: 'owner',
      isActive: true,
    });
  }

  return { tenantId: DEMO_FINANCE_TENANT_ID };
}

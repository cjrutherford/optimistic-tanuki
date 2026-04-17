import { ensureDemoFinanceTenant } from './seed-finance-support';

describe('ensureDemoFinanceTenant', () => {
  it('creates the demo tenant and membership before finance records depend on them', async () => {
    const tenantRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const tenantMemberRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (value) => value),
    };

    const result = await ensureDemoFinanceTenant(
      tenantRepo as any,
      tenantMemberRepo as any
    );

    expect(tenantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-0000-0000-000000000001',
        profileId: '00000000-0000-0000-0000-000000000001',
        appScope: 'finance',
        name: 'Demo Household',
      })
    );
    expect(tenantMemberRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '00000000-0000-0000-0000-000000000001',
        profileId: '00000000-0000-0000-0000-000000000001',
        role: 'owner',
      })
    );
    expect(result.tenantId).toBe('00000000-0000-0000-0000-000000000001');
  });
});

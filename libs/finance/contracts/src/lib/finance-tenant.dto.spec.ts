import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateFinanceTenantMemberDto,
  FINANCE_TENANT_MEMBER_ROLES,
  UpdateFinanceTenantMemberRoleDto,
} from './finance-tenant.dto';

describe('finance tenant member DTOs', () => {
  it('documents the member profile and role fields in the OpenAPI contract', () => {
    const createProperties = Reflect.getMetadata(
      'swagger/apiModelPropertiesArray',
      CreateFinanceTenantMemberDto.prototype
    );
    const updateProperties = Reflect.getMetadata(
      'swagger/apiModelPropertiesArray',
      UpdateFinanceTenantMemberRoleDto.prototype
    );

    expect(createProperties).toEqual(
      expect.arrayContaining([':memberProfileId', ':role'])
    );
    expect(updateProperties).toEqual(expect.arrayContaining([':role']));
  });

  it('accepts only UUID member profiles and supported member roles', async () => {
    const createDto = plainToInstance(CreateFinanceTenantMemberDto, {
      memberProfileId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'finance_admin',
    });
    const invalidCreateDto = plainToInstance(CreateFinanceTenantMemberDto, {
      memberProfileId: 'not-a-uuid',
      role: 'owner',
    });
    const invalidUpdateDto = plainToInstance(UpdateFinanceTenantMemberRoleDto, {
      role: 'owner',
    });

    await expect(validate(createDto)).resolves.toHaveLength(0);
    await expect(validate(invalidCreateDto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'memberProfileId' }),
        expect.objectContaining({ property: 'role' }),
      ])
    );
    await expect(validate(invalidUpdateDto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'role' })])
    );
    expect(FINANCE_TENANT_MEMBER_ROLES).toEqual([
      'finance_admin',
      'finance_member',
    ]);
  });
});

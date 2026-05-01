import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceTenantService } from './finance-tenant.service';
import { FinanceTenant } from '../../entities/finance-tenant.entity';
import { FinanceTenantMember } from '../../entities/finance-tenant-member.entity';

describe('FinanceTenantService', () => {
  let service: FinanceTenantService;
  let tenantRepo: jest.Mocked<Repository<FinanceTenant>>;
  let tenantMemberRepo: jest.Mocked<Repository<FinanceTenantMember>>;

  const mockRepoFactory = () => ({
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceTenantService,
        {
          provide: getRepositoryToken(FinanceTenant),
          useFactory: mockRepoFactory,
        },
        {
          provide: getRepositoryToken(FinanceTenantMember),
          useFactory: mockRepoFactory,
        },
      ],
    }).compile();

    service = module.get(FinanceTenantService);
    tenantRepo = module.get(getRepositoryToken(FinanceTenant));
    tenantMemberRepo = module.get(getRepositoryToken(FinanceTenantMember));
  });

  it('resolves the active tenant from profile and app scope context', async () => {
    tenantRepo.findOne.mockResolvedValue({
      id: 'tenant-1',
      name: 'Household',
      profileId: 'profile-1',
      appScope: 'finance',
    } as FinanceTenant);

    const tenant = await service.getCurrentTenant({
      profileId: 'profile-1',
      appScope: 'finance',
    });

    expect(tenantRepo.findOne).toHaveBeenCalledWith({
      where: {
        profileId: 'profile-1',
        appScope: 'finance',
        isActive: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });
    expect(tenant).toEqual({
      id: 'tenant-1',
      name: 'Household',
      profileId: 'profile-1',
      appScope: 'finance',
    });
  });

  it('lists members only for the active tenant', async () => {
    tenantRepo.findOne.mockResolvedValue({
      id: 'tenant-1',
      name: 'Household',
      profileId: 'profile-1',
      appScope: 'finance',
    } as FinanceTenant);
    tenantMemberRepo.find.mockResolvedValue([
      {
        id: 'member-1',
        tenantId: 'tenant-1',
        profileId: 'profile-1',
        role: 'finance_admin',
      },
    ] as FinanceTenantMember[]);

    const members = await service.listMembers({
      profileId: 'profile-1',
      appScope: 'finance',
    });

    expect(tenantMemberRepo.find).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        isActive: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });
    expect(members).toEqual([
      {
        id: 'member-1',
        tenantId: 'tenant-1',
        profileId: 'profile-1',
        role: 'finance_admin',
      },
    ]);
  });

  it('lists all accessible tenants for the active profile and app scope', async () => {
    tenantRepo.find.mockResolvedValue([
      {
        id: 'tenant-1',
        name: 'Household',
        profileId: 'profile-1',
        appScope: 'finance',
      },
      {
        id: 'tenant-2',
        name: 'Studio',
        profileId: 'profile-1',
        appScope: 'finance',
      },
    ] as FinanceTenant[]);

    const tenants = await service.listTenants({
      profileId: 'profile-1',
      appScope: 'finance',
    });

    expect(tenantRepo.find).toHaveBeenCalledWith({
      where: {
        profileId: 'profile-1',
        appScope: 'finance',
        isActive: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });
    expect(tenants).toEqual([
      {
        id: 'tenant-1',
        name: 'Household',
        profileId: 'profile-1',
        appScope: 'finance',
      },
      {
        id: 'tenant-2',
        name: 'Studio',
        profileId: 'profile-1',
        appScope: 'finance',
      },
    ]);
  });

  it('surfaces a missing current tenant for a new profile instead of auto-provisioning one', async () => {
    tenantRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getCurrentTenant({
        profileId: 'profile-1',
        appScope: 'finance',
      }),
    ).rejects.toMatchObject({
      constructor: RpcException,
    });

    expect(tenantRepo.save).not.toHaveBeenCalled();
    expect(tenantMemberRepo.save).not.toHaveBeenCalled();
  });

  it('returns no tenants for a new profile instead of creating a synthetic default', async () => {
    tenantRepo.find.mockResolvedValue([]);

    const tenants = await service.listTenants({
      profileId: 'profile-1',
      appScope: 'finance',
    });

    expect(tenants).toEqual([]);
    expect(tenantRepo.save).not.toHaveBeenCalled();
    expect(tenantMemberRepo.save).not.toHaveBeenCalled();
  });

  it('creates an explicit finance tenant with the requested account type', async () => {
    tenantRepo.save.mockResolvedValue({
      id: 'tenant-1',
      name: 'Primary Household',
      profileId: 'profile-1',
      appScope: 'finance',
      type: 'household',
      isActive: true,
    } as unknown as FinanceTenant);
    tenantMemberRepo.save.mockResolvedValue({
      id: 'member-1',
      tenantId: 'tenant-1',
      profileId: 'profile-1',
      role: 'finance_admin',
      isActive: true,
    } as FinanceTenantMember);

    const tenant = await service.createTenant({
      name: 'Primary Household',
      type: 'household',
      profileId: 'profile-1',
      appScope: 'finance',
    });

    expect(tenantRepo.save).toHaveBeenCalledWith({
      name: 'Primary Household',
      profileId: 'profile-1',
      appScope: 'finance',
      type: 'household',
      isActive: true,
    });
    expect(tenantMemberRepo.save).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      profileId: 'profile-1',
      role: 'finance_admin',
      isActive: true,
    });
    expect(tenant).toEqual({
      id: 'tenant-1',
      name: 'Primary Household',
      profileId: 'profile-1',
      appScope: 'finance',
      type: 'household',
    });
  });

  it('surfaces missing current tenants as rpc not found errors', async () => {
    tenantRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getCurrentTenant({
        tenantId: 'missing-tenant',
        profileId: 'profile-1',
        appScope: 'finance',
      }),
    ).rejects.toMatchObject({
      constructor: RpcException,
    });

    await service
      .getCurrentTenant({
        tenantId: 'missing-tenant',
        profileId: 'profile-1',
        appScope: 'finance',
      })
      .catch((error) => {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          statusCode: 404,
          message: 'Active finance tenant not found',
          error: 'Not Found',
        });
      });
  });

  it('wraps explicit tenant creation failures as rpc internal server errors', async () => {
    tenantRepo.save.mockRejectedValue(new Error('insert failed'));

    await service
      .createTenant({
        name: 'Primary Household',
        type: 'household',
        profileId: 'profile-1',
        appScope: 'finance',
      })
      .catch((error) => {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          statusCode: 500,
          message: 'insert failed',
          error: 'Internal Server Error',
        });
      });
  });
});

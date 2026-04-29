import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import {
  FinCommanderPlanStore,
  FinCommanderPlanApiService,
} from '@optimistic-tanuki/fin-commander-data-access';
import { ProfileContext } from './profile.context';
import { TenantContextService } from './tenant-context.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

describe('TenantContextService', () => {
  const financeProfile = {
    id: 'profile-1',
    userId: 'user-1',
    profileName: 'Finance Captain',
    profilePic: '',
    coverPic: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    created_at: new Date('2026-01-01'),
    appScope: 'finance',
  } satisfies ProfileDto;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('loads and stores the active finance tenant', async () => {
    const currentProfile = signal<ProfileDto | null>(null);
    const isAuthenticated = signal(false);
    const financeService = {
      getTenants: jest.fn().mockResolvedValue([
        {
          id: 'tenant-1',
          name: 'Household',
          profileId: 'profile-1',
          appScope: 'finance',
        },
      ]),
      getCurrentTenant: jest.fn().mockResolvedValue({
        id: 'tenant-1',
        name: 'Household',
        profileId: 'profile-1',
        appScope: 'finance',
      }),
      getTenantMembers: jest.fn().mockResolvedValue([]),
    };

    TestBed.configureTestingModule({
      providers: [
        TenantContextService,
        { provide: FinanceService, useValue: financeService },
        {
          provide: ProfileContext,
          useValue: {
            currentProfile,
            currentProfileId: computed(() => currentProfile()?.id ?? null),
            isAuthenticated,
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            setScope: jest.fn(),
          },
        },
      ],
    });

    const service = TestBed.inject(TenantContextService);

    await service.loadTenantContext();

    expect(financeService.getCurrentTenant).toHaveBeenCalled();
    expect(financeService.getTenantMembers).not.toHaveBeenCalled();
    expect(service.activeTenant()?.id).toBe('tenant-1');
  });

  it('loads all accessible tenants and allows switching the active tenant', async () => {
    const currentProfile = signal<ProfileDto | null>(financeProfile);
    const isAuthenticated = signal(true);
    const financeService = {
      getTenants: jest.fn().mockResolvedValue([
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
      ]),
      getCurrentTenant: jest.fn().mockResolvedValue({
        id: 'tenant-1',
        name: 'Household',
        profileId: 'profile-1',
        appScope: 'finance',
      }),
      getTenantMembers: jest.fn().mockResolvedValue([]),
    };

    TestBed.configureTestingModule({
      providers: [
        TenantContextService,
        { provide: FinanceService, useValue: financeService },
        {
          provide: ProfileContext,
          useValue: {
            currentProfile,
            currentProfileId: computed(() => currentProfile()?.id ?? null),
            isAuthenticated,
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            setScope: jest.fn(),
          },
        },
      ],
    });

    const service = TestBed.inject(TenantContextService);

    await service.loadTenantContext();
    service.selectTenant('tenant-2');

    expect(financeService.getTenants).toHaveBeenCalled();
    expect(financeService.getTenantMembers).not.toHaveBeenCalled();
    expect(service.availableTenants().map((tenant) => tenant.id)).toEqual([
      'tenant-1',
      'tenant-2',
    ]);
    expect(service.activeTenant()?.id).toBe('tenant-2');
    expect(localStorage.getItem('fin-commander-active-tenant-id')).toBe(
      'tenant-2',
    );
  });

  it('automatically syncs the active tenant and profile into the commander scope', async () => {
    const currentProfile = signal<ProfileDto | null>(null);
    const isAuthenticated = signal(true);
    const financeService = {
      getTenants: jest.fn().mockResolvedValue([
        {
          id: 'tenant-1',
          name: 'Household',
          profileId: 'profile-1',
          appScope: 'finance',
        },
        {
          id: 'tenant-2',
          name: 'Operations',
          profileId: 'profile-2',
          appScope: 'finance',
        },
      ]),
      getCurrentTenant: jest.fn().mockImplementation(async () => {
        const profileId = currentProfile()?.id;
        return profileId === 'profile-2'
          ? {
              id: 'tenant-2',
              name: 'Operations',
              profileId: 'profile-2',
              appScope: 'finance',
            }
          : {
              id: 'tenant-1',
              name: 'Household',
              profileId: 'profile-1',
              appScope: 'finance',
            };
      }),
      getTenantMembers: jest.fn().mockResolvedValue([]),
    };

    TestBed.configureTestingModule({
      providers: [
        TenantContextService,
        { provide: FinanceService, useValue: financeService },
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: FinCommanderPlanApiService,
          useValue: {
            listPlans: jest.fn().mockResolvedValue([]),
          },
        },
        FinCommanderPlanStore,
        {
          provide: ProfileContext,
          useValue: {
            currentProfile,
            currentProfileId: computed(() => currentProfile()?.id ?? null),
            isAuthenticated,
          },
        },
      ],
    });

    const service = TestBed.inject(TenantContextService);
    const store = TestBed.inject(FinCommanderPlanStore);

    currentProfile.set(financeProfile);
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.activeTenant()?.id).toBe('tenant-1');
    expect(store.getScope()).toEqual({
      tenantId: 'tenant-1',
      profileId: 'profile-1',
    });

    currentProfile.set({
      ...financeProfile,
      id: 'profile-2',
      profileName: 'Finance Operator',
    });
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.activeTenant()?.id).toBe('tenant-2');
    expect(store.getScope()).toEqual({
      tenantId: 'tenant-2',
      profileId: 'profile-2',
    });
  });

  it('refreshes active tenant scope after a newly created tenant is loaded', async () => {
    const currentProfile = signal<ProfileDto | null>(financeProfile);
    const isAuthenticated = signal(true);
    const financeService = {
      getTenants: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'tenant-1',
            name: 'Household',
            profileId: 'profile-1',
            appScope: 'finance',
            type: 'household',
          },
        ]),
      getCurrentTenant: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'tenant-1',
          name: 'Household',
          profileId: 'profile-1',
          appScope: 'finance',
          type: 'household',
        }),
      getTenantMembers: jest.fn().mockResolvedValue([]),
    };
    const setScope = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        TenantContextService,
        { provide: FinanceService, useValue: financeService },
        {
          provide: ProfileContext,
          useValue: {
            currentProfile,
            currentProfileId: computed(() => currentProfile()?.id ?? null),
            isAuthenticated,
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            setScope,
          },
        },
      ],
    });

    const service = TestBed.inject(TenantContextService);

    await service.loadTenantContext();
    await service.loadTenantContext();

    expect(service.activeTenant()?.id).toBe('tenant-1');
    expect(setScope).toHaveBeenLastCalledWith({
      tenantId: 'tenant-1',
      profileId: 'profile-1',
    });
  });

  it('creates a tenant, reloads context, and selects the new tenant', async () => {
    const currentProfile = signal<ProfileDto | null>(financeProfile);
    const isAuthenticated = signal(true);
    const financeService = {
      getTenants: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'tenant-1',
            name: 'Household',
            profileId: 'profile-1',
            appScope: 'finance',
            type: 'household',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'tenant-1',
            name: 'Household',
            profileId: 'profile-1',
            appScope: 'finance',
            type: 'household',
          },
          {
            id: 'tenant-2',
            name: 'Studio',
            profileId: 'profile-1',
            appScope: 'finance',
            type: 'business',
          },
        ]),
      getCurrentTenant: jest
        .fn()
        .mockResolvedValue({
          id: 'tenant-1',
          name: 'Household',
          profileId: 'profile-1',
          appScope: 'finance',
          type: 'household',
        }),
      createTenant: jest.fn().mockResolvedValue({
        id: 'tenant-2',
        name: 'Studio',
        profileId: 'profile-1',
        appScope: 'finance',
        type: 'business',
      }),
      getTenantMembers: jest.fn().mockResolvedValue([]),
    };
    const setScope = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        TenantContextService,
        { provide: FinanceService, useValue: financeService },
        {
          provide: ProfileContext,
          useValue: {
            currentProfile,
            currentProfileId: computed(() => currentProfile()?.id ?? null),
            isAuthenticated,
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            setScope,
          },
        },
      ],
    });

    const service = TestBed.inject(TenantContextService);

    await service.loadTenantContext();
    await service.createTenant({
      name: 'Studio',
      type: 'business',
    });

    expect(financeService.createTenant).toHaveBeenCalledWith({
      name: 'Studio',
      type: 'business',
    });
    expect(service.activeTenant()?.id).toBe('tenant-2');
    expect(setScope).toHaveBeenLastCalledWith({
      tenantId: 'tenant-2',
      profileId: 'profile-1',
    });
    expect(localStorage.getItem('fin-commander-active-tenant-id')).toBe(
      'tenant-2',
    );
  });
});

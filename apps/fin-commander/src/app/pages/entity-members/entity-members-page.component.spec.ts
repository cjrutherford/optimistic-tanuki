import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  FinanceService,
  FinanceTenantMember,
} from '@optimistic-tanuki/finance-ui';
import { ProfileContext } from '../../profile.context';
import { TenantContextService } from '../../tenant-context.service';
import { EntityMembersPageComponent } from './entity-members-page.component';

describe('EntityMembersPageComponent', () => {
  const members: FinanceTenantMember[] = [
    {
      id: 'owner-membership',
      tenantId: 'tenant-1',
      profileId: 'profile-1',
      role: 'finance_admin',
    },
    {
      id: 'member-membership',
      tenantId: 'tenant-1',
      profileId: 'profile-2',
      role: 'finance_member',
    },
  ];
  const finance = {
    getTenantMembers: jest.fn(),
    addTenantMember: jest.fn(),
    updateTenantMemberRole: jest.fn(),
    removeTenantMember: jest.fn(),
  };
  const tenantContext = {
    activeTenant: jest.fn().mockReturnValue({
      id: 'tenant-1',
      name: 'North Household',
      type: 'household',
      profileId: 'profile-1',
      appScope: 'finance',
    }),
  };
  const profileContext = {
    currentProfileId: jest.fn().mockReturnValue('profile-1'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    finance.getTenantMembers.mockResolvedValue(members);
    finance.addTenantMember.mockResolvedValue(members[1]);
    finance.updateTenantMemberRole.mockResolvedValue(members[1]);
    finance.removeTenantMember.mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [EntityMembersPageComponent],
      providers: [
        provideRouter([]),
        { provide: FinanceService, useValue: finance },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: ProfileContext, useValue: profileContext },
      ],
    }).compileComponents();
  });

  it('loads the active tenant and exposes operator controls only to operators', async () => {
    const fixture = TestBed.createComponent(EntityMembersPageComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(finance.getTenantMembers).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.tenantName()).toBe('North Household');
    expect(fixture.componentInstance.isOperator()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Active collaborators');
    expect(fixture.nativeElement.textContent).toContain('Operator');
    expect(fixture.nativeElement.textContent).toContain('Member');
  });

  it('does not expose controls to a non-operator', async () => {
    profileContext.currentProfileId.mockReturnValue('profile-2');
    const fixture = TestBed.createComponent(EntityMembersPageComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.isOperator()).toBe(false);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('view-only');
  });

  it('validates a profile id before sending an invite', async () => {
    const fixture = TestBed.createComponent(EntityMembersPageComponent);
    await fixture.whenStable();
    fixture.componentInstance.profileId = 'not-a-profile-id';

    await fixture.componentInstance.add();

    expect(finance.addTenantMember).not.toHaveBeenCalled();
    expect(fixture.componentInstance.message()).toContain('valid profile ID');
  });

  it('surfaces denied access when the membership API rejects the load', async () => {
    finance.getTenantMembers.mockRejectedValue({ status: 403 });
    const fixture = TestBed.createComponent(EntityMembersPageComponent);
    await fixture.whenStable();

    expect(fixture.componentInstance.accessDenied()).toBe(true);
    expect(fixture.componentInstance.message()).toContain('operator');
  });

  it("treats the gateway's masked 404 membership denial as access denied", async () => {
    finance.getTenantMembers.mockRejectedValue({ status: 404 });
    const fixture = TestBed.createComponent(EntityMembersPageComponent);
    await fixture.whenStable();

    expect(fixture.componentInstance.accessDenied()).toBe(true);
    expect(fixture.componentInstance.message()).toContain('operator');
  });

  it('confirms before revoking access and refreshes after the confirmed mutation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(EntityMembersPageComponent);
    await fixture.whenStable();

    await fixture.componentInstance.remove('member-membership');
    expect(confirmSpy).toHaveBeenCalled();
    expect(finance.removeTenantMember).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await fixture.componentInstance.remove('member-membership');
    expect(finance.removeTenantMember).toHaveBeenCalledWith(
      'member-membership'
    );
    expect(fixture.componentInstance.message()).toContain('revoked');
    confirmSpy.mockRestore();
  });
});

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { RolesService } from '../services/roles.service';
import { UsersService } from '../services/users.service';
import { UsersManagementComponent } from './users-management.component';

describe('UsersManagementComponent', () => {
  let rolesService: {
    getRoles: jest.Mock;
    getUserRoles: jest.Mock;
    assignRole: jest.Mock;
    unassignRole: jest.Mock;
  };
  let usersService: {
    getProfiles: jest.Mock;
    getProfileTelos: jest.Mock;
    regenerateProfileTelos: jest.Mock;
    regenerateProfileTelosBulk: jest.Mock;
    resetProfileTelos: jest.Mock;
  };
  let messageService: { clearMessages: jest.Mock; addMessage: jest.Mock };

  beforeEach(async () => {
    rolesService = {
      getRoles: jest.fn().mockReturnValue(
        of([
          {
            id: 'role-1',
            name: 'owner_console_owner',
            description: 'Owner',
            appScope: { id: 'scope-1', name: 'global' },
          },
        ])
      ),
      getUserRoles: jest.fn().mockReturnValue(of([])),
      assignRole: jest.fn().mockReturnValue(of({ id: 'assignment-1' })),
      unassignRole: jest.fn().mockReturnValue(of({})),
    };
    usersService = {
      getProfiles: jest.fn().mockReturnValue(of([])),
      getProfileTelos: jest.fn().mockReturnValue(of(null)),
      regenerateProfileTelos: jest.fn().mockReturnValue(of({})),
      regenerateProfileTelosBulk: jest.fn().mockReturnValue(of([])),
      resetProfileTelos: jest.fn().mockReturnValue(of({})),
    };
    messageService = {
      clearMessages: jest.fn(),
      addMessage: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [UsersManagementComponent],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: RolesService, useValue: rolesService },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();
  });

  it('opens role management and loads assignable roles for the selected user', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;
    const user = { id: 'profile-1', profileName: 'Operator One' };

    component.onManageRoles(user);

    expect(rolesService.getRoles).toHaveBeenCalled();
    expect(rolesService.getUserRoles).toHaveBeenCalledWith('profile-1');
    expect(component.showRoleModal).toBe(true);
    expect(component.selectedUser).toEqual(user);
  });

  it('assigns a role to the selected user using the role app scope', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;
    component.selectedUser = { id: 'profile-1', profileName: 'Operator One' };

    component.assignRole({
      id: 'role-1',
      name: 'owner_console_owner',
      appScope: { id: 'scope-1', name: 'global' },
    });

    expect(rolesService.assignRole).toHaveBeenCalledWith({
      roleId: 'role-1',
      profileId: 'profile-1',
      appScopeId: 'scope-1',
    });
  });

  it('unassigns an existing role assignment from the selected user', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;

    component.unassignRole({
      id: 'assignment-1',
      role: { name: 'owner_console_owner' },
    });

    expect(rolesService.unassignRole).toHaveBeenCalledWith('assignment-1');
  });

  it('opens telos management and loads telos for the selected user', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;
    const user = { id: 'profile-1', profileName: 'Operator One' };

    component.onManageTelos(user);

    expect(usersService.getProfileTelos).toHaveBeenCalledWith('profile-1');
    expect(component.showTelosModal).toBe(true);
    expect(component.selectedUser).toEqual(user);
  });

  it('triggers a telos rebuild for the selected user', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;
    component.selectedUser = { id: 'profile-1', profileName: 'Operator One' };

    component.regenerateTelos();

    expect(usersService.regenerateProfileTelos).toHaveBeenCalledWith(
      'profile-1'
    );
  });

  it('triggers a bulk telos rebuild for seeded users', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;
    component.seededUserIds = ['profile-1', 'profile-2'];

    component.rebuildSeededTelos();

    expect(usersService.regenerateProfileTelosBulk).toHaveBeenCalledWith([
      'profile-1',
      'profile-2',
    ]);
  });

  it('resets derived telos fields for the selected user', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;
    component.selectedUser = { id: 'profile-1', profileName: 'Operator One' };

    component.resetTelos();

    expect(usersService.resetProfileTelos).toHaveBeenCalledWith('profile-1');
  });

  it('identifies seeded demo users by email convention', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;

    expect(
      component['isSeededUser']({
        id: 'profile-1',
        email: 'seeded.user@example.com',
      })
    ).toBe(true);
    expect(
      component['isSeededUser']({
        id: 'profile-2',
        email: 'real.user@company.com',
      })
    ).toBe(false);
  });
});

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { RolesService } from '../services/roles.service';
import { UsersService } from '../services/users.service';
import { GovernanceAuditService } from '../services/governance-audit.service';
import { UsersManagementComponent } from './users-management.component';

describe('UsersManagementComponent', () => {
  let rolesService: {
    getRoles: jest.Mock;
    getUserRoles: jest.Mock;
    assignRole: jest.Mock;
    unassignRole: jest.Mock;
    previewBulkRoleMutation: jest.Mock;
    executeBulkRoleMutation: jest.Mock;
  };
  let usersService: {
    getProfiles: jest.Mock;
    getProfileTelos: jest.Mock;
    regenerateProfileTelos: jest.Mock;
    regenerateProfileTelosBulk: jest.Mock;
    resetProfileTelos: jest.Mock;
  };
  let messageService: { clearMessages: jest.Mock; addMessage: jest.Mock };
  let router: { navigate: jest.Mock };
  let governanceAuditService: {
    getEntries: jest.Mock;
    recordEntry: jest.Mock;
  };

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
      previewBulkRoleMutation: jest.fn().mockReturnValue(
        of({
          operation: 'assign',
          roleId: 'role-1',
          roleName: 'owner_console_owner',
          appScopeId: 'scope-1',
          targetId: 'community-1',
          totalSelected: 2,
          affectedCount: 1,
          unchangedCount: 1,
          affectedProfileIds: ['profile-1'],
          unchangedProfileIds: ['profile-2'],
          existingAssignmentIds: [],
          permissionChangeSummary: [
            {
              permissionName: 'users.update',
              resource: 'users',
              action: 'update',
              status: 'already-present',
              affectedProfileCount: 1,
            },
            {
              permissionName: 'roles.update',
              resource: 'roles',
              action: 'update',
              status: 'added',
              affectedProfileCount: 1,
            },
          ],
          profileImpacts: [
            {
              profileId: 'profile-1',
              profileName: 'Operator One',
              permissionChanges: [
                {
                  permissionName: 'users.update',
                  resource: 'users',
                  action: 'update',
                  status: 'already-present',
                },
                {
                  permissionName: 'roles.update',
                  resource: 'roles',
                  action: 'update',
                  status: 'added',
                },
              ],
            },
          ],
        })
      ),
      executeBulkRoleMutation: jest.fn().mockReturnValue(
        of({
          operation: 'assign',
          roleId: 'role-1',
          roleName: 'owner_console_owner',
          appScopeId: 'scope-1',
          targetId: 'community-1',
          totalSelected: 2,
          affectedCount: 1,
          unchangedCount: 1,
          affectedProfileIds: ['profile-1'],
          unchangedProfileIds: ['profile-2'],
          existingAssignmentIds: [],
          permissionChangeSummary: [],
          profileImpacts: [],
          completedCount: 1,
        })
      ),
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
    router = {
      navigate: jest.fn(),
    };
    governanceAuditService = {
      getEntries: jest.fn().mockReturnValue([]),
      recordEntry: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [UsersManagementComponent],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: RolesService, useValue: rolesService },
        { provide: MessageService, useValue: messageService },
        { provide: Router, useValue: router },
        {
          provide: GovernanceAuditService,
          useValue: governanceAuditService,
        },
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

  it('previews a bulk role assignment for the selected users and role', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;

    component.rolesCatalog = [
      {
        id: 'role-1',
        name: 'owner_console_owner',
        appScope: { id: 'scope-1', name: 'global' },
      },
    ];
    component.onSelectedUsersChange([
      { id: 'profile-1', profileName: 'Operator One' },
      { id: 'profile-2', profileName: 'Operator Two' },
    ]);
    component.bulkRoleId = 'role-1';
    component.bulkTargetId = 'community-1';
    component.previewBulkRoleMutation();

    expect(rolesService.previewBulkRoleMutation).toHaveBeenCalledWith({
      operation: 'assign',
      roleId: 'role-1',
      profileIds: ['profile-1', 'profile-2'],
      appScopeId: 'scope-1',
      targetId: 'community-1',
    });
    expect(component.bulkPreview?.affectedCount).toBe(1);
  });

  it('summarizes permission impact language for the bulk preview', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;

    component.bulkPreview = {
      operation: 'assign',
      roleId: 'role-1',
      roleName: 'owner_console_owner',
      appScopeId: 'scope-1',
      targetId: 'community-1',
      totalSelected: 1,
      affectedCount: 1,
      unchangedCount: 0,
      affectedProfileIds: ['profile-1'],
      unchangedProfileIds: [],
      existingAssignmentIds: [],
      permissionChangeSummary: [
        {
          permissionName: 'roles.update',
          resource: 'roles',
          action: 'update',
          status: 'added',
          affectedProfileCount: 1,
        },
      ],
      profileImpacts: [
        {
          profileId: 'profile-1',
          profileName: 'Operator One',
          permissionChanges: [
            {
              permissionName: 'roles.update',
              resource: 'roles',
              action: 'update',
              status: 'added',
            },
          ],
        },
      ],
    };

    expect(component.describePermissionStatus('added')).toContain('new access');
    expect(component.describePermissionStatus('already-present')).toContain(
      'already'
    );
    expect(
      component.bulkPreview.permissionChangeSummary[0].permissionName
    ).toBe('roles.update');
  });

  it('executes a bulk role mutation and clears the preview state', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;

    component.users = [
      { id: 'profile-1', profileName: 'Operator One' },
      { id: 'profile-2', profileName: 'Operator Two' },
    ];
    component.rolesCatalog = [
      {
        id: 'role-1',
        name: 'owner_console_owner',
        appScope: { id: 'scope-1', name: 'global' },
      },
    ];
    component.onSelectedUsersChange([
      { id: 'profile-1', profileName: 'Operator One' },
      { id: 'profile-2', profileName: 'Operator Two' },
    ]);
    component.bulkRoleId = 'role-1';
    component.bulkTargetId = 'community-1';
    component.bulkPreview = {
      operation: 'assign',
      roleId: 'role-1',
      roleName: 'owner_console_owner',
      appScopeId: 'scope-1',
      targetId: 'community-1',
      totalSelected: 2,
      affectedCount: 1,
      unchangedCount: 1,
      affectedProfileIds: ['profile-1'],
      unchangedProfileIds: ['profile-2'],
      existingAssignmentIds: [],
      permissionChangeSummary: [],
      profileImpacts: [],
    };

    component.executeBulkRoleMutation();

    expect(rolesService.executeBulkRoleMutation).toHaveBeenCalledWith({
      operation: 'assign',
      roleId: 'role-1',
      profileIds: ['profile-1', 'profile-2'],
      appScopeId: 'scope-1',
      targetId: 'community-1',
    });
    expect(governanceAuditService.recordEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'bulk-role-mutation',
        roleId: 'role-1',
        roleName: 'owner_console_owner',
      })
    );
    expect(component.bulkPreview).toBeNull();
    expect(component.selectedUsers.length).toBe(0);
    expect(component.lastBulkMutationResult?.targetId).toBe('community-1');
  });

  it('rolls back the last bulk mutation with the inverse operation and same scope', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;

    component.lastBulkMutationPayload = {
      operation: 'assign',
      roleId: 'role-1',
      profileIds: ['profile-1', 'profile-2'],
      appScopeId: 'scope-1',
      targetId: 'community-1',
    };
    component.lastBulkMutationResult = {
      operation: 'assign',
      roleId: 'role-1',
      roleName: 'owner_console_owner',
      appScopeId: 'scope-1',
      targetId: 'community-1',
      totalSelected: 2,
      affectedCount: 1,
      unchangedCount: 1,
      affectedProfileIds: ['profile-1'],
      unchangedProfileIds: ['profile-2'],
      existingAssignmentIds: [],
      permissionChangeSummary: [],
      profileImpacts: [],
      completedCount: 1,
    };

    component.rollbackLastBulkMutation();

    expect(rolesService.executeBulkRoleMutation).toHaveBeenCalledWith({
      operation: 'unassign',
      roleId: 'role-1',
      profileIds: ['profile-1', 'profile-2'],
      appScopeId: 'scope-1',
      targetId: 'community-1',
    });
    expect(governanceAuditService.recordEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'bulk-role-mutation',
        operation: 'unassign',
      })
    );
  });

  it('routes a single selected profile into permissions inspector tracing', () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    const component = fixture.componentInstance as any;

    component.onSelectedUsersChange([
      { id: 'profile-1', profileName: 'Operator One' },
    ]);
    component.traceSelectedProfileAccess();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/dashboard/permissions-inspector'],
      {
        queryParams: {
          profileId: 'profile-1',
          source: 'users',
        },
      }
    );
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

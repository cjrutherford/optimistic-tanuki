import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { AppScopesService } from '../services/app-scopes.service';
import { PermissionsService } from '../services/permissions.service';
import { RolesService } from '../services/roles.service';
import { UsersService } from '../services/users.service';
import { GovernanceAuditService } from '../services/governance-audit.service';
import { RolesManagementComponent } from './roles-management.component';

describe('RolesManagementComponent', () => {
  let rolesService: {
    getRoles: jest.Mock;
    getRole: jest.Mock;
    createRole: jest.Mock;
    updateRole: jest.Mock;
    deleteRole: jest.Mock;
    addPermissionToRole: jest.Mock;
    removePermissionFromRole: jest.Mock;
  };
  let appScopesService: { getAppScopes: jest.Mock };
  let permissionsService: { getPermissions: jest.Mock };
  let usersService: { getProfiles: jest.Mock };
  let messageService: {
    messages: ReturnType<typeof signal>;
    clearMessages: jest.Mock;
    addMessage: jest.Mock;
  };
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
            permissions: [{ id: 'perm-1', name: 'users.update' }],
          },
        ])
      ),
      getRole: jest.fn().mockReturnValue(
        of({
          id: 'role-1',
          name: 'owner_console_owner',
          description: 'Owner',
          appScope: { id: 'scope-1', name: 'global' },
          permissions: [
            { id: 'perm-1', name: 'users.update', description: 'Users update' },
          ],
        })
      ),
      createRole: jest.fn().mockReturnValue(of({ id: 'role-2' })),
      updateRole: jest.fn().mockReturnValue(of({ id: 'role-1' })),
      deleteRole: jest.fn().mockReturnValue(of(undefined)),
      addPermissionToRole: jest.fn().mockReturnValue(of({ success: true })),
      removePermissionFromRole: jest
        .fn()
        .mockReturnValue(of({ success: true })),
    };
    appScopesService = {
      getAppScopes: jest
        .fn()
        .mockReturnValue(of([{ id: 'scope-1', name: 'global' }])),
    };
    permissionsService = {
      getPermissions: jest.fn().mockReturnValue(
        of([
          {
            id: 'perm-1',
            name: 'users.update',
            description: 'Users update',
            resource: 'users',
            action: 'update',
          },
          {
            id: 'perm-2',
            name: 'roles.update',
            description: 'Roles update',
            resource: 'roles',
            action: 'update',
          },
        ])
      ),
    };
    usersService = {
      getProfiles: jest.fn().mockReturnValue(
        of([
          {
            id: 'profile-1',
            profileName: 'Operator One',
            appScope: 'global',
          },
          {
            id: 'profile-2',
            profileName: 'Operator Two',
            appScope: 'global',
          },
        ])
      ),
    };
    messageService = {
      messages: signal([]),
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
      imports: [RolesManagementComponent],
      providers: [
        { provide: RolesService, useValue: rolesService },
        { provide: AppScopesService, useValue: appScopesService },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: UsersService, useValue: usersService },
        { provide: MessageService, useValue: messageService },
        { provide: Router, useValue: router },
        {
          provide: GovernanceAuditService,
          useValue: governanceAuditService,
        },
      ],
    }).compileComponents();
  });

  it('loads permissions alongside roles and app scopes on init', () => {
    const fixture = TestBed.createComponent(RolesManagementComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    expect(permissionsService.getPermissions).toHaveBeenCalled();
    expect(component.permissions.length).toBe(2);
    expect(component.availablePermissions.length).toBe(2);
  });

  it('loads authoritative role permissions when opening edit mode', () => {
    const fixture = TestBed.createComponent(RolesManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.openEditModal({
      id: 'role-1',
      name: 'owner_console_owner',
      description: 'Owner',
      appScope: { id: 'scope-1', name: 'global' },
    });

    expect(rolesService.getRole).toHaveBeenCalledWith('role-1');
    expect(component.currentRole.permissions).toEqual([
      { id: 'perm-1', name: 'users.update', description: 'Users update' },
    ]);
    expect(component.availablePermissions).toEqual([
      expect.objectContaining({ id: 'perm-2' }),
    ]);
    expect(component.roleImpactSummary).toEqual(
      expect.objectContaining({
        assignedProfileCount: 0,
      })
    );
  });

  it('attaches a permission to the selected role and refreshes role data', () => {
    const fixture = TestBed.createComponent(RolesManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.openEditModal({
      id: 'role-1',
      name: 'owner_console_owner',
      description: 'Owner',
      appScope: { id: 'scope-1', name: 'global' },
    });
    rolesService.getRole.mockClear();

    component.addPermission('perm-2');

    expect(rolesService.addPermissionToRole).toHaveBeenCalledWith(
      'role-1',
      'perm-2'
    );
    expect(rolesService.getRole).toHaveBeenCalledWith('role-1');
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
    expect(governanceAuditService.recordEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'role-permission-added',
        roleId: 'role-1',
        permissionId: 'perm-2',
      })
    );
  });

  it('removes a permission from the selected role and refreshes role data', () => {
    const fixture = TestBed.createComponent(RolesManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.openEditModal({
      id: 'role-1',
      name: 'owner_console_owner',
      description: 'Owner',
      appScope: { id: 'scope-1', name: 'global' },
    });
    rolesService.getRole.mockClear();

    component.removePermission('perm-1');

    expect(rolesService.removePermissionFromRole).toHaveBeenCalledWith(
      'role-1',
      'perm-1'
    );
    expect(rolesService.getRole).toHaveBeenCalledWith('role-1');
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
    expect(governanceAuditService.recordEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'role-permission-removed',
        roleId: 'role-1',
        permissionId: 'perm-1',
      })
    );
  });

  it('does not allow permission mutation in create mode', () => {
    const fixture = TestBed.createComponent(RolesManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.openCreateModal();
    component.addPermission('perm-2');
    component.removePermission('perm-1');

    expect(rolesService.addPermissionToRole).not.toHaveBeenCalled();
    expect(rolesService.removePermissionFromRole).not.toHaveBeenCalled();
  });

  it('surfaces permission mutation failures without changing role state', () => {
    rolesService.addPermissionToRole.mockReturnValue(
      throwError(() => new Error('attach failed'))
    );
    const fixture = TestBed.createComponent(RolesManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.openEditModal({
      id: 'role-1',
      name: 'owner_console_owner',
      description: 'Owner',
      appScope: { id: 'scope-1', name: 'global' },
    });
    rolesService.getRole.mockClear();

    component.addPermission('perm-2');

    expect(rolesService.getRole).not.toHaveBeenCalled();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
    expect(component.currentRole.permissions).toEqual([
      { id: 'perm-1', name: 'users.update', description: 'Users update' },
    ]);
  });

  it('routes the current role into permissions inspector tracing', () => {
    const fixture = TestBed.createComponent(RolesManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.currentRole = {
      id: 'role-1',
      name: 'owner_console_owner',
      permissions: [],
    };
    component.traceRoleAssignments();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/dashboard/permissions-inspector'],
      {
        queryParams: {
          roleId: 'role-1',
          roleName: 'owner_console_owner',
          source: 'roles',
        },
      }
    );
  });
});

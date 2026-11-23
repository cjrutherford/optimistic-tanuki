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
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import { RolesManagementComponent } from './roles-management.component';
import {
  createOwnerConfirmStub,
  OwnerConfirmStub,
} from './owner-confirm.testing';

const role = {
  id: 'role-1',
  name: 'owner_console_owner',
  description: 'Owner',
  appScope: { id: 'scope-1', name: 'global' },
  permissions: [{ id: 'perm-1', name: 'users.update' }],
};

describe('RolesManagementComponent workflows', () => {
  let rolesService: Record<string, jest.Mock>;
  let appScopesService: { getAppScopes: jest.Mock };
  let permissionsService: { getPermissions: jest.Mock };
  let usersService: { getProfiles: jest.Mock };
  let messageService: {
    messages: ReturnType<typeof signal>;
    clearMessages: jest.Mock;
    addMessage: jest.Mock;
  };
  let router: { navigate: jest.Mock };
  let confirmStub: OwnerConfirmStub;
  let governanceAuditService: { getEntries: jest.Mock; recordEntry: jest.Mock };

  beforeEach(async () => {
    rolesService = {
      getRoles: jest.fn().mockReturnValue(of([role])),
      getRole: jest.fn().mockReturnValue(of(role)),
      createRole: jest.fn().mockReturnValue(of({ id: 'role-2' })),
      updateRole: jest.fn().mockReturnValue(of({ id: 'role-1' })),
      deleteRole: jest.fn().mockReturnValue(of(undefined)),
      addPermissionToRole: jest.fn().mockReturnValue(of({ success: true })),
      removePermissionFromRole: jest
        .fn()
        .mockReturnValue(of({ success: true })),
      getUserRoles: jest.fn().mockReturnValue(of([])),
    };
    appScopesService = {
      getAppScopes: jest
        .fn()
        .mockReturnValue(of([{ id: 'scope-1', name: 'global' }])),
    };
    permissionsService = {
      getPermissions: jest.fn().mockReturnValue(
        of([
          { id: 'perm-1', name: 'users.update' },
          { id: 'perm-2', name: 'roles.update' },
        ])
      ),
    };
    usersService = {
      getProfiles: jest.fn().mockReturnValue(
        of([
          { id: 'profile-1', profileName: 'Operator One', userId: 'user-1' },
          { id: 'profile-2', profileName: '', userId: 'user-2' },
        ])
      ),
    };
    messageService = {
      messages: signal([]),
      clearMessages: jest.fn(),
      addMessage: jest.fn(),
    };
    router = { navigate: jest.fn() };
    confirmStub = createOwnerConfirmStub();
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
        { provide: OwnerConfirmService, useValue: confirmStub },
        { provide: GovernanceAuditService, useValue: governanceAuditService },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(RolesManagementComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  const validForm = (component: RolesManagementComponent) => {
    component.formData = {
      name: 'ops',
      description: 'Ops role',
      appScopeId: 'scope-1',
    };
  };

  describe('loading', () => {
    it('shows an empty table, not an error, when no roles exist', () => {
      rolesService['getRoles'].mockReturnValue(of([]));

      const component = create();

      expect(component.loadError).toBeNull();
      expect(component.visibleRoles).toEqual([]);
    });

    it('shows error and retry, never an empty list, when loading fails', () => {
      rolesService['getRoles'].mockReturnValue(
        throwError(() => ({ error: { message: 'Upstream is down' } }))
      );
      const fixture = TestBed.createComponent(RolesManagementComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      expect(component.loadError).toBe('Upstream is down');
      expect(component.visibleRoles).toBeNull();

      rolesService['getRoles'].mockReturnValue(of([role]));
      component.loadRoles();
      expect(component.loadError).toBeNull();
      expect(component.visibleRoles).toEqual([role]);
    });

    it('has no hero banner and a plain page header', () => {
      const fixture = TestBed.createComponent(RolesManagementComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('.hero')).toBeNull();
      expect(el.querySelector('ot-owner-page-header')).not.toBeNull();
    });

    it('filters roles by search text', () => {
      const component = create();

      component.onSearch('nomatch');
      expect(component.visibleRoles).toEqual([]);
      component.onSearch('OWNER');
      expect(component.visibleRoles).toEqual([role]);
    });

    it('surfaces the server message when loading roles fails', () => {
      rolesService['getRoles'].mockReturnValue(
        throwError(() => ({ error: { message: 'Upstream is down' } }))
      );

      const component = create();

      expect(component.loading).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Upstream is down',
        type: 'error',
      });
    });

    it('falls back to a generic message when the failure carries none', () => {
      rolesService['getRoles'].mockReturnValue(throwError(() => ({})));

      create();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to load roles. Please try again.',
        type: 'error',
      });
    });

    it('logs but tolerates app scope and permission load failures', () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      appScopesService.getAppScopes.mockReturnValue(
        throwError(() => new Error('scopes down'))
      );
      permissionsService.getPermissions.mockReturnValue(
        throwError(() => new Error('permissions down'))
      );

      const component = create();

      expect(component.appScopes).toEqual([]);
      expect(component.permissions).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load app scopes:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  describe('modal state', () => {
    it('resets the form and impact summary when opening create mode', () => {
      const component = create();

      component.openEditModal(role as never);
      component.openCreateModal();

      expect(component.isEditMode).toBe(false);
      expect(component.currentRole).toBeNull();
      expect(component.showFormModal).toBe(true);
      expect(component.formData).toEqual({
        name: '',
        description: '',
        appScopeId: '',
      });
      expect(component.roleImpactSummary).toEqual({
        assignedProfileCount: 0,
        appScopeLabel: 'Scope unavailable',
        sampleProfiles: [],
      });
    });

    it('defaults the scope id to empty when the role has no app scope', () => {
      const component = create();

      component.openEditModal({ ...role, appScope: undefined } as never);

      expect(component.formData.appScopeId).toBe('');
    });

    it('closes the form modal', () => {
      const component = create();

      component.openCreateModal();
      component.closeFormModal();
      expect(component.showFormModal).toBe(false);
    });

    it('asks for the role name before deleting, then deletes', async () => {
      const component = create();

      await component.openDeleteConfirm(role as never);

      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'typed',
          typedPhrase: 'owner_console_owner',
          destructive: true,
        })
      );
      expect(rolesService['deleteRole']).toHaveBeenCalledWith('role-1');
    });

    it('does not delete when the confirmation is declined', async () => {
      confirmStub.confirm.mockResolvedValue({ confirmed: false });
      const component = create();

      await component.openDeleteConfirm(role as never);

      expect(rolesService['deleteRole']).not.toHaveBeenCalled();
    });
  });

  describe('form validation and confirmation', () => {
    it('rejects a form missing any required field', () => {
      const component = create();

      component.formData = { name: ' ', description: '', appScopeId: '' };
      expect(component.isFormValid()).toBe(false);

      component.formData = {
        name: 'ops',
        description: '',
        appScopeId: 'scope-1',
      };
      expect(component.isFormValid()).toBe(false);

      component.formData = {
        name: 'ops',
        description: 'Ops role',
        appScopeId: '  ',
      };
      expect(component.isFormValid()).toBe(false);
    });

    it('accepts a fully populated form', () => {
      const component = create();
      validForm(component);

      expect(component.isFormValid()).toBe(true);
    });

    it('refuses to submit an invalid form', async () => {
      const component = create();

      component.formData = { name: '', description: '', appScopeId: '' };
      await component.submitForm();

      expect(confirmStub.confirm).not.toHaveBeenCalled();
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Please fill in all required fields.',
        type: 'error',
      });
    });

    it('creates after a plain confirmation', async () => {
      const component = create();

      component.openCreateModal();
      validForm(component);
      await component.submitForm();

      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'plain' })
      );
      expect(rolesService['createRole']).toHaveBeenCalled();
    });

    it('updates only after a reason confirmation', async () => {
      const component = create();

      component.openEditModal(role as never);
      component.formData = { ...component.formData, name: 'renamed' };
      await component.submitForm();

      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'reason' })
      );
      expect(rolesService['updateRole']).toHaveBeenCalled();
    });

    it('does not save when the confirmation is declined', async () => {
      confirmStub.confirm.mockResolvedValue({ confirmed: false });
      const component = create();

      component.openCreateModal();
      validForm(component);
      await component.submitForm();

      expect(rolesService['createRole']).not.toHaveBeenCalled();
    });
  });

  describe('app scope select', () => {
    it('adopts the selected scope id', () => {
      const component = create();
      const select = document.createElement('select');
      const option = document.createElement('option');
      option.value = 'scope-1';
      select.appendChild(option);
      select.value = 'scope-1';

      component.onAppScopeSelect({ target: select } as unknown as Event);

      expect(component.formData.appScopeId).toBe('scope-1');
    });

    it('ignores an empty selection', () => {
      const component = create();
      component.formData.appScopeId = 'scope-1';
      const select = document.createElement('select');

      component.onAppScopeSelect({ target: select } as unknown as Event);

      expect(component.formData.appScopeId).toBe('scope-1');
    });
  });

  describe('create, update and delete', () => {
    it('creates a role and reloads the table', () => {
      const component = create();

      component.openCreateModal();
      validForm(component);
      component.createRole();

      expect(rolesService['createRole']).toHaveBeenCalledWith({
        name: 'ops',
        description: 'Ops role',
        appScopeId: 'scope-1',
      });
      expect(component.showFormModal).toBe(false);
      expect(rolesService['getRoles']).toHaveBeenCalledTimes(2);
    });

    it('reports a create failure', () => {
      rolesService['createRole'].mockReturnValue(
        throwError(() => new Error('duplicate role'))
      );
      const component = create();

      validForm(component);
      component.createRole();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'duplicate role',
        type: 'error',
      });
    });

    it('records an audit entry when a role is updated', () => {
      const component = create();

      component.openEditModal(role as never);
      component.formData = {
        id: 'role-1',
        name: 'renamed',
        description: 'Renamed',
        appScopeId: 'scope-1',
      };
      component.updateRole();

      expect(rolesService['updateRole']).toHaveBeenCalledWith('role-1', {
        name: 'renamed',
        description: 'Renamed',
        appScopeId: 'scope-1',
      });
      expect(governanceAuditService.recordEntry).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'role-updated', roleId: 'role-1' })
      );
      expect(component.showFormModal).toBe(false);
    });

    it('skips the update request without a role id', () => {
      const component = create();

      component.formData = {
        name: 'ops',
        description: 'Ops',
        appScopeId: 'scope-1',
      };
      component.updateRole();

      expect(rolesService['updateRole']).not.toHaveBeenCalled();
    });

    it('reports an update failure', () => {
      rolesService['updateRole'].mockReturnValue(throwError(() => ({})));
      const component = create();

      component.formData = {
        id: 'role-1',
        name: 'ops',
        description: 'Ops',
        appScopeId: 'scope-1',
      };
      component.updateRole();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to update role.',
        type: 'error',
      });
    });

    it('deletes the staged role and records an audit entry', () => {
      const component = create();

      component.currentRole = role as never;
      component.deleteRole();

      expect(rolesService['deleteRole']).toHaveBeenCalledWith('role-1');
      expect(governanceAuditService.recordEntry).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'role-deleted', roleId: 'role-1' })
      );
    });

    it('skips the delete request when nothing is staged', () => {
      const component = create();

      component.currentRole = null;
      component.deleteRole();

      expect(rolesService['deleteRole']).not.toHaveBeenCalled();
    });

    it('reports a delete failure', () => {
      rolesService['deleteRole'].mockReturnValue(
        throwError(() => new Error('role in use'))
      );
      const component = create();

      component.currentRole = role as never;
      component.deleteRole();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'role in use',
        type: 'error',
      });
    });
  });

  describe('permission mutation failures', () => {
    it('reports a remove-permission failure', async () => {
      rolesService['removePermissionFromRole'].mockReturnValue(
        throwError(() => new Error('detach failed'))
      );
      const component = create();

      component.openEditModal(role as never);
      await component.removePermission('perm-1');

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'detach failed',
        type: 'error',
      });
    });

    it('logs a failure to refresh the role detail', () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      rolesService['getRole'].mockReturnValue(
        throwError(() => new Error('refresh failed'))
      );
      const component = create();

      component.openEditModal(role as never);

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to refresh role details:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  describe('role impact summary', () => {
    it('counts the profiles holding the role and samples their names', () => {
      rolesService['getUserRoles'].mockImplementation((profileId: string) =>
        of(
          profileId === 'profile-1'
            ? [{ roleId: 'role-1' }]
            : [{ roleId: 'role-9' }]
        )
      );
      const component = create();

      component.openEditModal(role as never);

      expect(component.roleImpactSummary).toEqual({
        assignedProfileCount: 1,
        appScopeLabel: 'global',
        sampleProfiles: ['Operator One'],
      });
    });

    it('falls back to the user id when a profile has no name', () => {
      rolesService['getUserRoles'].mockReturnValue(of([{ roleId: 'role-1' }]));
      const component = create();

      component.openEditModal(role as never);

      expect(component.roleImpactSummary.sampleProfiles).toEqual([
        'Operator One',
        'user-2',
      ]);
    });

    it('leaves the summary empty when there are no profiles', () => {
      usersService.getProfiles.mockReturnValue(of([]));
      const component = create();

      component.openEditModal(role as never);

      expect(component.roleImpactSummary).toEqual({
        assignedProfileCount: 0,
        appScopeLabel: 'global',
        sampleProfiles: [],
      });
    });

    it('resets the summary when the assignment lookup fails', () => {
      rolesService['getUserRoles'].mockReturnValue(
        throwError(() => new Error('lookup failed'))
      );
      const component = create();

      component.openEditModal({ ...role, appScope: undefined } as never);

      expect(component.roleImpactSummary).toEqual({
        assignedProfileCount: 0,
        appScopeLabel: 'Scope unavailable',
        sampleProfiles: [],
      });
    });

    it('resets the summary when the profile lookup fails', () => {
      usersService.getProfiles.mockReturnValue(
        throwError(() => new Error('profiles down'))
      );
      const component = create();

      component.openEditModal(role as never);

      expect(component.roleImpactSummary).toEqual({
        assignedProfileCount: 0,
        appScopeLabel: 'global',
        sampleProfiles: [],
      });
    });
  });

  it('does not trace assignments without a current role', () => {
    const component = create();

    component.currentRole = null;
    component.traceRoleAssignments();

    expect(router.navigate).not.toHaveBeenCalled();
  });
});

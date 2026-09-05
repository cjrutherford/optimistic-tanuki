import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { ProfileDto, RoleDto, UserRoleDto } from '@optimistic-tanuki/ui-models';

import { RolesService } from '../services/roles.service';
import { UsersService } from '../services/users.service';
import { GovernanceAuditService } from '../services/governance-audit.service';
import { UsersManagementComponent } from './users-management.component';

const profiles = [
  { id: 'profile-1', profileName: 'Operator One', userId: 'user-1' },
  { id: 'profile-2', profileName: '', userId: 'user-2' },
] as ProfileDto[];

const roles = [
  {
    id: 'role-1',
    name: 'owner',
    description: 'Owner',
    appScope: { id: 'scope-1', name: 'global' },
  },
  { id: 'role-2', name: 'orphan', description: 'No scope' },
] as RoleDto[];

const mutationResult = {
  operation: 'assign',
  roleId: 'role-1',
  roleName: 'owner',
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

describe('UsersManagementComponent workflows', () => {
  let rolesService: Record<string, jest.Mock>;
  let usersService: { getProfiles: jest.Mock };
  let messageService: {
    messages: ReturnType<typeof signal>;
    clearMessages: jest.Mock;
    addMessage: jest.Mock;
  };
  let router: { navigate: jest.Mock };
  let governanceAuditService: { getEntries: jest.Mock; recordEntry: jest.Mock };

  beforeEach(async () => {
    rolesService = {
      getRoles: jest.fn().mockReturnValue(of(roles)),
      getUserRoles: jest.fn().mockReturnValue(of([])),
      assignRole: jest.fn().mockReturnValue(of({ id: 'assignment-1' })),
      unassignRole: jest.fn().mockReturnValue(of({})),
      previewBulkRoleMutation: jest
        .fn()
        .mockReturnValue(of({ ...mutationResult })),
      executeBulkRoleMutation: jest
        .fn()
        .mockReturnValue(of({ ...mutationResult })),
    };
    usersService = { getProfiles: jest.fn().mockReturnValue(of(profiles)) };
    messageService = {
      messages: signal([]),
      clearMessages: jest.fn(),
      addMessage: jest.fn(),
    };
    router = { navigate: jest.fn() };
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
        { provide: GovernanceAuditService, useValue: governanceAuditService },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(UsersManagementComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  const stageBulk = (component: UsersManagementComponent) => {
    component.onSelectedUsersChange(profiles);
    component.onBulkRoleChange('role-1');
    component.onBulkTargetChange(' community-1 ');
  };

  describe('loading users', () => {
    it('loads profiles and the roles catalog on init', () => {
      const component = create();

      expect(component.users).toHaveLength(2);
      expect(component.rolesCatalog).toHaveLength(2);
      expect(component.loading).toBe(false);
    });

    it('tells the operator when no users exist', () => {
      usersService.getProfiles.mockReturnValue(of([]));

      create();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'No users found in the system.',
        type: 'info',
      });
    });

    it('surfaces the server message when loading users fails', () => {
      usersService.getProfiles.mockReturnValue(
        throwError(() => ({ error: { message: 'Profile service down' } }))
      );

      const component = create();

      expect(component.loading).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Profile service down',
        type: 'error',
      });
    });

    it('falls back to a generic user load message', () => {
      usersService.getProfiles.mockReturnValue(throwError(() => ({})));

      create();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to load users. Please try again.',
        type: 'error',
      });
    });

    it('empties the roles catalog when it cannot be loaded', () => {
      rolesService['getRoles'].mockReturnValue(
        throwError(() => new Error('roles down'))
      );

      const component = create();

      expect(component.rolesCatalog).toEqual([]);
    });
  });

  describe('role modal', () => {
    it('splits assigned from available roles', () => {
      rolesService['getUserRoles'].mockReturnValue(
        of([{ id: 'assignment-1', roleId: 'role-1' }] as UserRoleDto[])
      );
      const component = create();

      component.onManageRoles(profiles[0]);

      expect(component.showRoleModal).toBe(true);
      expect(component.userRoles).toHaveLength(1);
      expect(component.availableRoles.map((r) => r.id)).toEqual(['role-2']);
      expect(component.roleModalHeading).toBe('Manage Roles: Operator One');
    });

    it('clears the modal state on close', () => {
      const component = create();

      component.onManageRoles(profiles[0]);
      component.closeRoleModal();

      expect(component.showRoleModal).toBe(false);
      expect(component.selectedUser).toBeNull();
      expect(component.roles).toEqual([]);
      expect(component.userRoles).toEqual([]);
      expect(component.availableRoles).toEqual([]);
      expect(component.roleModalHeading).toBe('Manage Roles');
    });

    it('reports a role management load failure', () => {
      rolesService['getUserRoles'].mockReturnValue(
        throwError(() => ({ error: { message: 'assignments down' } }))
      );
      const component = create();

      component.onManageRoles(profiles[0]);

      expect(component.roleManagementLoading).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'assignments down',
        type: 'error',
      });
    });

    it('labels a role scope, falling back when it is missing', () => {
      const component = create();

      expect(component.resolveRoleScopeLabel(roles[0])).toBe('global');
      expect(component.resolveRoleScopeLabel(roles[1])).toBe(
        'Scope unavailable'
      );
    });
  });

  describe('single role assignment', () => {
    it('does nothing when no user is selected', () => {
      const component = create();

      component.assignRole(roles[0]);

      expect(rolesService['assignRole']).not.toHaveBeenCalled();
    });

    it('refuses to assign a role with no app scope', () => {
      const component = create();

      component.onManageRoles(profiles[0]);
      component.assignRole(roles[1]);

      expect(rolesService['assignRole']).not.toHaveBeenCalled();
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Cannot assign orphan because it has no app scope.',
        type: 'error',
      });
    });

    it('assigns the role using its own app scope and reloads', () => {
      const component = create();

      component.onManageRoles(profiles[0]);
      component.assignRole(roles[0]);

      expect(rolesService['assignRole']).toHaveBeenCalledWith({
        roleId: 'role-1',
        profileId: 'profile-1',
        appScopeId: 'scope-1',
      });
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Assigned owner to Operator One.',
        type: 'success',
      });
    });

    it('falls back to a generic assign error message', () => {
      rolesService['assignRole'].mockReturnValue(throwError(() => ({})));
      const component = create();

      component.onManageRoles(profiles[0]);
      component.assignRole(roles[0]);

      expect(component.roleMutationLoading).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to assign owner.',
        type: 'error',
      });
    });
  });

  describe('single role removal', () => {
    it('removes the assignment and reloads the selected user', () => {
      const component = create();

      component.onManageRoles(profiles[0]);
      component.unassignRole({
        id: 'assignment-1',
        role: { name: 'owner' },
      } as UserRoleDto);

      expect(rolesService['unassignRole']).toHaveBeenCalledWith('assignment-1');
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Removed owner from Operator One.',
        type: 'success',
      });
    });

    it('names the assignment generically when the role is unknown', () => {
      const component = create();

      component.unassignRole({ id: 'assignment-1' } as UserRoleDto);

      expect(component.roleMutationLoading).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Removed role from selected user.',
        type: 'success',
      });
    });

    it('reports a removal failure', () => {
      rolesService['unassignRole'].mockReturnValue(throwError(() => ({})));
      const component = create();

      component.unassignRole({ id: 'assignment-1' } as UserRoleDto);

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to remove role assignment.',
        type: 'error',
      });
    });
  });

  describe('bulk mutation gating', () => {
    it('requires both a selection and a role before previewing', () => {
      const component = create();

      expect(component.canPreviewBulkMutation).toBe(false);

      component.onSelectedUsersChange(profiles);
      expect(component.canPreviewBulkMutation).toBe(false);

      component.onBulkRoleChange('role-1');
      expect(component.canPreviewBulkMutation).toBe(true);
    });

    it('requires a preview with impact before executing', () => {
      const component = create();

      expect(component.canExecuteBulkMutation).toBe(false);

      stageBulk(component);
      component.previewBulkRoleMutation();
      expect(component.canExecuteBulkMutation).toBe(true);

      component.bulkPreview = { ...mutationResult, affectedCount: 0 } as never;
      expect(component.canExecuteBulkMutation).toBe(false);
    });

    it('labels the execute button per operation', () => {
      const component = create();

      expect(component.bulkExecuteLabel).toBe('Apply Assignment');

      component.onBulkOperationChange('unassign');
      expect(component.bulkExecuteLabel).toBe('Apply Removal');
    });

    it('drops any staged preview when the selection inputs change', () => {
      const component = create();

      stageBulk(component);
      component.previewBulkRoleMutation();
      expect(component.bulkPreview).not.toBeNull();

      component.onBulkOperationChange('unassign');
      expect(component.bulkPreview).toBeNull();
    });

    it('skips the preview request when no role resolves a scope', () => {
      const component = create();

      component.onSelectedUsersChange(profiles);
      component.onBulkRoleChange('role-2');
      component.previewBulkRoleMutation();

      expect(rolesService['previewBulkRoleMutation']).not.toHaveBeenCalled();
    });

    it('omits a blank target id from the payload', () => {
      const component = create();

      component.onSelectedUsersChange(profiles);
      component.onBulkRoleChange('role-1');
      component.onBulkTargetChange('   ');
      component.previewBulkRoleMutation();

      expect(rolesService['previewBulkRoleMutation']).toHaveBeenCalledWith({
        operation: 'assign',
        roleId: 'role-1',
        profileIds: ['profile-1', 'profile-2'],
        appScopeId: 'scope-1',
        targetId: undefined,
      });
    });

    it('reports a preview failure', () => {
      rolesService['previewBulkRoleMutation'].mockReturnValue(
        throwError(() => ({}))
      );
      const component = create();

      stageBulk(component);
      component.previewBulkRoleMutation();

      expect(component.bulkPreviewLoading).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to preview the selected governance mutation.',
        type: 'error',
      });
    });
  });

  describe('bulk mutation execution', () => {
    it('does nothing without a staged preview', () => {
      const component = create();

      stageBulk(component);
      component.executeBulkRoleMutation();

      expect(rolesService['executeBulkRoleMutation']).not.toHaveBeenCalled();
    });

    it('records an audit entry and clears the selection', () => {
      const component = create();

      stageBulk(component);
      component.previewBulkRoleMutation();
      component.executeBulkRoleMutation();

      expect(governanceAuditService.recordEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'bulk-role-mutation',
          operation: 'assign',
          roleId: 'role-1',
          profileIds: ['profile-1', 'profile-2'],
        })
      );
      expect(component.selectedUsers).toEqual([]);
      expect(component.bulkPreview).toBeNull();
      expect(component.selectionResetKey).toBe(1);
    });

    it('refreshes the open role modal when it targets an affected profile', () => {
      const component = create();

      component.onManageRoles(profiles[0]);
      stageBulk(component);
      component.previewBulkRoleMutation();
      rolesService['getUserRoles'].mockClear();
      component.executeBulkRoleMutation();

      expect(rolesService['getUserRoles']).toHaveBeenCalledWith('profile-1');
    });

    it('reports an execution failure', () => {
      rolesService['executeBulkRoleMutation'].mockReturnValue(
        throwError(() => ({}))
      );
      const component = create();

      stageBulk(component);
      component.previewBulkRoleMutation();
      component.executeBulkRoleMutation();

      expect(component.bulkMutationLoading).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to execute the selected governance mutation.',
        type: 'error',
      });
    });
  });

  describe('rollback', () => {
    it('is unavailable until a mutation has run', () => {
      const component = create();

      expect(component.canRollbackLastBulkMutation).toBe(false);

      component.rollbackLastBulkMutation();
      expect(rolesService['executeBulkRoleMutation']).not.toHaveBeenCalled();
    });

    it('replays the last payload with the inverse operation', () => {
      const component = create();

      stageBulk(component);
      component.previewBulkRoleMutation();
      component.executeBulkRoleMutation();
      rolesService['executeBulkRoleMutation'].mockClear();
      rolesService['executeBulkRoleMutation'].mockReturnValue(
        of({ ...mutationResult, operation: 'unassign' })
      );

      component.rollbackLastBulkMutation();

      expect(rolesService['executeBulkRoleMutation']).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'unassign', roleId: 'role-1' })
      );
      expect(component.rollbackLoading).toBe(false);
      expect(component.rollbackActionLabel).toBe('Restore Assignment');
    });

    it('labels the rollback action after an assignment', () => {
      const component = create();

      stageBulk(component);
      component.previewBulkRoleMutation();
      component.executeBulkRoleMutation();

      expect(component.rollbackActionLabel).toBe('Rollback Assignment');
      expect(component.canRollbackLastBulkMutation).toBe(true);
    });

    it('reports a rollback failure', () => {
      const component = create();

      stageBulk(component);
      component.previewBulkRoleMutation();
      component.executeBulkRoleMutation();
      rolesService['executeBulkRoleMutation'].mockReturnValue(
        throwError(() => ({}))
      );

      component.rollbackLastBulkMutation();

      expect(component.rollbackLoading).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to rollback the last governance mutation.',
        type: 'error',
      });
    });
  });

  describe('display helpers', () => {
    it('describes profiles by name, then user id, then raw id', () => {
      const component = create();

      expect(
        component.describeProfiles(['profile-1', 'profile-2', 'profile-9'])
      ).toBe('Operator One, user-2, profile-9');
      expect(component.getProfileDisplayName('profile-1')).toBe('Operator One');
    });

    it('translates each permission change status', () => {
      const component = create();

      expect(component.describePermissionStatus('added')).toBe(
        'Will grant new access'
      );
      expect(component.describePermissionStatus('removed')).toBe(
        'Will remove access'
      );
      expect(component.describePermissionStatus('retained')).toBe(
        'Access remains through another role'
      );
      expect(component.describePermissionStatus('already-present')).toBe(
        'Profile already had this access'
      );
      expect(component.describePermissionStatus('unheard-of' as never)).toBe(
        'unheard-of'
      );
    });

    it('summarises an audit entry, including the optional target', () => {
      const component = create();

      expect(component.buildAuditSummary(mutationResult as never)).toBe(
        'owner assignment completed for 1 of 2 selected profiles in scope scope-1 targeting community-1.'
      );
      expect(
        component.buildAuditSummary({
          ...mutationResult,
          operation: 'unassign',
          targetId: undefined,
        } as never)
      ).toBe(
        'owner removal completed for 1 of 2 selected profiles in scope scope-1.'
      );
    });
  });

  describe('tracing', () => {
    it('only traces when exactly one profile is selected', () => {
      const component = create();

      component.onSelectedUsersChange(profiles);
      component.traceSelectedProfileAccess();
      expect(router.navigate).not.toHaveBeenCalled();

      component.onSelectedUsersChange([profiles[0]]);
      component.traceSelectedProfileAccess();
      expect(router.navigate).toHaveBeenCalledWith(
        ['/dashboard/permissions-inspector'],
        { queryParams: { profileId: 'profile-1', source: 'users' } }
      );
    });
  });
});

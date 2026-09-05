import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { PermissionDto } from '@optimistic-tanuki/ui-models';

import { AppScopesService } from '../services/app-scopes.service';
import { PermissionsService } from '../services/permissions.service';
import { PermissionsManagementComponent } from './permissions-management.component';

const permission = {
  id: 'perm-1',
  name: 'users.read',
  description: 'Read users',
  resource: 'users',
  action: 'read',
  targetId: 'target-1',
} as PermissionDto;

describe('PermissionsManagementComponent', () => {
  let permissionsService: Record<string, jest.Mock>;
  let appScopesService: { getAppScopes: jest.Mock };
  let messageService: {
    messages: ReturnType<typeof signal>;
    clearMessages: jest.Mock;
    addMessage: jest.Mock;
  };

  beforeEach(async () => {
    permissionsService = {
      getPermissions: jest.fn().mockReturnValue(of([permission])),
      createPermission: jest.fn().mockReturnValue(of(permission)),
      updatePermission: jest.fn().mockReturnValue(of(permission)),
      deletePermission: jest.fn().mockReturnValue(of(undefined)),
    };
    appScopesService = {
      getAppScopes: jest
        .fn()
        .mockReturnValue(of([{ id: 'scope-1', name: 'global' }])),
    };
    messageService = {
      messages: signal([]),
      clearMessages: jest.fn(),
      addMessage: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PermissionsManagementComponent],
      providers: [
        { provide: PermissionsService, useValue: permissionsService },
        { provide: AppScopesService, useValue: appScopesService },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(PermissionsManagementComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  const fillForm = (component: PermissionsManagementComponent) => {
    component.formData = {
      name: 'orders.read',
      description: 'Read orders',
      resource: 'orders',
      action: 'read',
      targetId: undefined,
    };
  };

  describe('loading', () => {
    it('loads permissions and app scopes on init', () => {
      const component = create();

      expect(component.permissions).toHaveLength(1);
      expect(component.appScopes).toHaveLength(1);
      expect(component.loading).toBe(false);
    });

    it('tells the operator when no permissions exist', () => {
      permissionsService['getPermissions'].mockReturnValue(of([]));

      create();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'No permissions found in the system.',
        type: 'info',
      });
    });

    it('surfaces the server message when loading permissions fails', () => {
      permissionsService['getPermissions'].mockReturnValue(
        throwError(() => ({ error: { message: 'Permission service down' } }))
      );

      const component = create();

      expect(component.loading).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Permission service down',
        type: 'error',
      });
    });

    it('falls back to a generic permission load message', () => {
      permissionsService['getPermissions'].mockReturnValue(
        throwError(() => ({}))
      );

      create();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to load permissions. Please try again.',
        type: 'error',
      });
    });

    it('logs but tolerates an app scope load failure', () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      appScopesService.getAppScopes.mockReturnValue(
        throwError(() => new Error('scopes down'))
      );

      const component = create();

      expect(component.appScopes).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load app scopes:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  describe('modals', () => {
    it('resets the form when opening create mode', () => {
      const component = create();

      component.openEditModal(permission);
      component.openCreateModal();

      expect(component.isEditMode).toBe(false);
      expect(component.currentPermission).toBeNull();
      expect(component.formData).toEqual({
        name: '',
        description: '',
        resource: '',
        action: '',
        targetId: undefined,
      });
      expect(component.showFormModal).toBe(true);
    });

    it('seeds the edit form from the permission', () => {
      const component = create();

      component.openEditModal(permission);

      expect(component.isEditMode).toBe(true);
      expect(component.formData).toEqual({
        id: 'perm-1',
        name: 'users.read',
        description: 'Read users',
        resource: 'users',
        action: 'read',
        targetId: 'target-1',
      });
    });

    it('closes both modals', () => {
      const component = create();

      component.openCreateModal();
      component.closeFormModal();
      expect(component.showFormModal).toBe(false);

      component.openDeleteConfirm(permission);
      component.closeConfirmModal();
      expect(component.showConfirmModal).toBe(false);
    });

    it('stages a delete confirmation', () => {
      const component = create();

      component.openDeleteConfirm(permission);

      expect(component.currentPermission).toEqual(permission);
      expect(component.confirmAction).toBe('delete');
      expect(component.confirmModalTitle).toBe('Confirm Permission Deletion');
      expect(component.showConfirmModal).toBe(true);
    });
  });

  describe('validation and confirmation', () => {
    it('requires name, description, resource and action', () => {
      const component = create();

      component.formData = {
        name: '',
        description: 'd',
        resource: 'r',
        action: 'a',
      };
      expect(component.isFormValid()).toBe(false);

      component.formData = {
        name: 'n',
        description: '',
        resource: 'r',
        action: 'a',
      };
      expect(component.isFormValid()).toBe(false);

      component.formData = {
        name: 'n',
        description: 'd',
        resource: ' ',
        action: 'a',
      };
      expect(component.isFormValid()).toBe(false);

      component.formData = {
        name: 'n',
        description: 'd',
        resource: 'r',
        action: '  ',
      };
      expect(component.isFormValid()).toBe(false);

      component.formData = {
        name: 'n',
        description: 'd',
        resource: 'r',
        action: 'a',
      };
      expect(component.isFormValid()).toBe(true);
    });

    it('refuses to confirm an invalid form', () => {
      const component = create();

      component.formData = {
        name: '',
        description: '',
        resource: '',
        action: '',
      };
      component.confirmFormSubmit();

      expect(component.showConfirmModal).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Please fill in all required fields.',
        type: 'error',
      });
    });

    it('stages create and update confirmations', () => {
      const component = create();

      component.openCreateModal();
      fillForm(component);
      component.confirmFormSubmit();
      expect(component.confirmAction).toBe('create');
      expect(component.confirmModalTitle).toBe('Confirm Permission Creation');

      component.openEditModal(permission);
      component.confirmFormSubmit();
      expect(component.confirmAction).toBe('update');
      expect(component.confirmModalTitle).toBe('Confirm Permission Update');
    });

    it('dispatches the staged action', () => {
      const component = create();
      const createSpy = jest.spyOn(component, 'createPermission');
      const updateSpy = jest.spyOn(component, 'updatePermission');
      const deleteSpy = jest.spyOn(component, 'deletePermission');

      component.confirmAction = 'create';
      component.executeConfirmedAction();
      component.confirmAction = 'update';
      component.executeConfirmedAction();
      component.confirmAction = 'delete';
      component.executeConfirmedAction();

      expect(createSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(deleteSpy).toHaveBeenCalled();
    });
  });

  describe('mutations', () => {
    it('creates a permission, normalising an empty target id to undefined', () => {
      const component = create();

      component.openCreateModal();
      fillForm(component);
      component.formData.targetId = '';
      component.createPermission();

      expect(permissionsService['createPermission']).toHaveBeenCalledWith({
        name: 'orders.read',
        description: 'Read orders',
        resource: 'orders',
        action: 'read',
        targetId: undefined,
      });
      expect(component.showFormModal).toBe(false);
      expect(permissionsService['getPermissions']).toHaveBeenCalledTimes(2);
    });

    it('reports a create failure', () => {
      permissionsService['createPermission'].mockReturnValue(
        throwError(() => new Error('duplicate permission'))
      );
      const component = create();

      component.createPermission();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'duplicate permission',
        type: 'error',
      });
    });

    it('updates a permission and reloads', () => {
      const component = create();

      component.openEditModal(permission);
      component.formData.description = 'Read all users';
      component.updatePermission();

      expect(permissionsService['updatePermission']).toHaveBeenCalledWith(
        'perm-1',
        expect.objectContaining({ description: 'Read all users' })
      );
      expect(component.showFormModal).toBe(false);
    });

    it('skips the update request without an id', () => {
      const component = create();

      component.openCreateModal();
      component.updatePermission();

      expect(permissionsService['updatePermission']).not.toHaveBeenCalled();
    });

    it('reports an update failure', () => {
      permissionsService['updatePermission'].mockReturnValue(
        throwError(() => ({}))
      );
      const component = create();

      component.openEditModal(permission);
      component.updatePermission();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to update permission.',
        type: 'error',
      });
    });

    it('deletes the staged permission and reloads', () => {
      const component = create();

      component.openDeleteConfirm(permission);
      component.deletePermission();

      expect(permissionsService['deletePermission']).toHaveBeenCalledWith(
        'perm-1'
      );
      expect(component.showConfirmModal).toBe(false);
      expect(permissionsService['getPermissions']).toHaveBeenCalledTimes(2);
    });

    it('skips the delete request when nothing is staged', () => {
      const component = create();

      component.currentPermission = null;
      component.deletePermission();

      expect(permissionsService['deletePermission']).not.toHaveBeenCalled();
    });

    it('reports a delete failure', () => {
      permissionsService['deletePermission'].mockReturnValue(
        throwError(() => new Error('permission in use'))
      );
      const component = create();

      component.openDeleteConfirm(permission);
      component.deletePermission();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'permission in use',
        type: 'error',
      });
    });
  });
});

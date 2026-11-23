import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { PermissionDto } from '@optimistic-tanuki/ui-models';

import {
  createOwnerConfirmStub,
  OwnerConfirmStub,
} from './owner-confirm.testing';
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
  let lastFixture: ComponentFixture<PermissionsManagementComponent>;
  let confirmStub: OwnerConfirmStub;
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
    confirmStub = createOwnerConfirmStub();
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
        { provide: OwnerConfirmService, useValue: confirmStub },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(PermissionsManagementComponent);
    fixture.detectChanges();
    lastFixture = fixture;
    return fixture.componentInstance;
  };

  const text = () =>
    (lastFixture.nativeElement as HTMLElement).textContent ?? '';

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

    it('shows an empty state, not a message, when no permissions exist', () => {
      permissionsService['getPermissions'].mockReturnValue(of([]));

      const component = create();

      expect(component.loadError).toBe('');
      expect(text()).toContain('No permissions exist yet.');
    });

    it('shows Unavailable with the server message when loading fails', () => {
      permissionsService['getPermissions'].mockReturnValue(
        throwError(() => ({ error: { message: 'Permission service down' } }))
      );

      const component = create();

      expect(component.loading).toBe(false);
      expect(component.loadError).toBe('Permission service down');
      expect(text()).toContain('Unavailable');
      expect(text()).toContain('Permission service down');
    });

    it('falls back to a generic message and retries on demand', () => {
      permissionsService['getPermissions'].mockReturnValueOnce(
        throwError(() => ({}))
      );

      const component = create();
      expect(component.loadError).toBe(
        'Failed to load permissions. Please try again.'
      );

      const retry = (lastFixture.nativeElement as HTMLElement).querySelector(
        'ot-owner-state button'
      ) as HTMLButtonElement;
      retry.click();
      lastFixture.detectChanges();

      expect(permissionsService['getPermissions']).toHaveBeenCalledTimes(2);
      expect(component.loadError).toBe('');
      expect(component.permissions).toHaveLength(1);
    });

    it('treats a non-array reply as an empty list', () => {
      permissionsService['getPermissions'].mockReturnValue(
        of({ message: 'x' } as never)
      );

      const component = create();

      expect(component.permissions).toEqual([]);
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

    it('closes the form modal', () => {
      const component = create();

      component.openCreateModal();
      component.closeFormModal();
      expect(component.showFormModal).toBe(false);
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

    it('refuses to confirm an invalid form', async () => {
      const component = create();

      component.formData = {
        name: '',
        description: '',
        resource: '',
        action: '',
      };
      await component.confirmFormSubmit();

      expect(confirmStub.confirm).not.toHaveBeenCalled();
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Please fill in all required fields.',
        type: 'error',
      });
    });

    it('asks for a plain confirmation before creating', async () => {
      const component = create();
      const createSpy = jest.spyOn(component, 'createPermission');

      component.openCreateModal();
      fillForm(component);
      await component.confirmFormSubmit();

      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'plain' })
      );
      expect(createSpy).toHaveBeenCalled();
    });

    it('asks for a reason before updating', async () => {
      const component = create();
      const updateSpy = jest.spyOn(component, 'updatePermission');

      component.openEditModal(permission);
      await component.confirmFormSubmit();

      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'reason' })
      );
      expect(updateSpy).toHaveBeenCalled();
    });

    it('does nothing when the confirmation is declined', async () => {
      confirmStub.confirm.mockResolvedValue({ confirmed: false });
      const component = create();
      const updateSpy = jest.spyOn(component, 'updatePermission');

      component.openEditModal(permission);
      await component.confirmFormSubmit();
      await component.openDeleteConfirm(permission);

      expect(updateSpy).not.toHaveBeenCalled();
      expect(permissionsService['deletePermission']).not.toHaveBeenCalled();
    });

    it('requires typing the name before deleting', async () => {
      const component = create();

      await component.openDeleteConfirm(permission);

      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'typed',
          typedPhrase: 'users.read',
          destructive: true,
        })
      );
      expect(permissionsService['deletePermission']).toHaveBeenCalledWith(
        'perm-1'
      );
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

    it('deletes the confirmed permission and reloads', async () => {
      const component = create();

      await component.openDeleteConfirm(permission);

      expect(permissionsService['deletePermission']).toHaveBeenCalledWith(
        'perm-1'
      );
      expect(permissionsService['getPermissions']).toHaveBeenCalledTimes(2);
    });

    it('skips the delete request when nothing is staged', () => {
      const component = create();

      component.currentPermission = null;
      component.deletePermission();

      expect(permissionsService['deletePermission']).not.toHaveBeenCalled();
    });

    it('reports a delete failure', async () => {
      permissionsService['deletePermission'].mockReturnValue(
        throwError(() => new Error('permission in use'))
      );
      const component = create();

      await component.openDeleteConfirm(permission);

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'permission in use',
        type: 'error',
      });
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { AppScopeDto } from '@optimistic-tanuki/ui-models';

import { AppScopesService } from '../services/app-scopes.service';
import { PermissionsService } from '../services/permissions.service';
import { AppScopesManagementComponent } from './app-scopes-management.component';

const scopes = [
  { id: 'scope-1', name: 'global', description: 'Global scope', active: true },
  { id: 'scope-2', name: 'store', description: 'Store scope', active: false },
] as AppScopeDto[];

const permissions = [
  { id: 'perm-1', name: 'users.read', appScope: { id: 'scope-1' } },
  { id: 'perm-2', name: 'users.write', appScope: { id: 'scope-1' } },
  { id: 'perm-3', name: 'orders.read', appScope: { id: 'scope-2' } },
  { id: 'perm-4', name: 'unscoped' },
] as never[];

describe('AppScopesManagementComponent', () => {
  let appScopesService: Record<string, jest.Mock>;
  let permissionsService: { getPermissions: jest.Mock };
  let messageService: {
    messages: ReturnType<typeof signal>;
    clearMessages: jest.Mock;
    addMessage: jest.Mock;
  };

  beforeEach(async () => {
    appScopesService = {
      getAppScopes: jest.fn().mockReturnValue(of(scopes)),
      createAppScope: jest.fn().mockReturnValue(of(scopes[0])),
      updateAppScope: jest.fn().mockReturnValue(of(scopes[0])),
      deleteAppScope: jest.fn().mockReturnValue(of(undefined)),
    };
    permissionsService = {
      getPermissions: jest.fn().mockReturnValue(of(permissions)),
    };
    messageService = {
      messages: signal([]),
      clearMessages: jest.fn(),
      addMessage: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppScopesManagementComponent],
      providers: [
        { provide: AppScopesService, useValue: appScopesService },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(AppScopesManagementComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  describe('loading', () => {
    it('counts the permissions attached to each scope', () => {
      const component = create();

      expect(component.appScopes).toHaveLength(2);
      expect(component.permissionCountsMap.get('scope-1')).toBe(2);
      expect(component.permissionCountsMap.get('scope-2')).toBe(1);
    });

    it('tells the operator when no scopes exist', () => {
      appScopesService['getAppScopes'].mockReturnValue(of([]));

      create();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'No app scopes found in the system.',
        type: 'info',
      });
    });

    it('surfaces the server message when loading scopes fails', () => {
      appScopesService['getAppScopes'].mockReturnValue(
        throwError(() => ({ error: { message: 'Scope service down' } }))
      );

      const component = create();

      expect(component.loading).toBe(false);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Scope service down',
        type: 'error',
      });
    });

    it('falls back to a generic scope load message', () => {
      appScopesService['getAppScopes'].mockReturnValue(throwError(() => ({})));

      create();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to load app scopes. Please try again.',
        type: 'error',
      });
    });

    it('logs but tolerates a permission load failure', () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      permissionsService.getPermissions.mockReturnValue(
        throwError(() => new Error('permissions down'))
      );

      const component = create();

      expect(component.permissions).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load permissions:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  describe('modals', () => {
    it('resets the form when opening create mode', () => {
      const component = create();

      component.openEditModal(scopes[0]);
      component.openCreateModal();

      expect(component.isEditMode).toBe(false);
      expect(component.currentAppScope).toBeNull();
      expect(component.relatedPermissions).toEqual([]);
      expect(component.formData).toEqual({
        name: '',
        description: '',
        active: true,
      });
      expect(component.showFormModal).toBe(true);
    });

    it('seeds the edit form and related permissions', () => {
      const component = create();

      component.openEditModal(scopes[0]);

      expect(component.isEditMode).toBe(true);
      expect(component.formData).toEqual({
        id: 'scope-1',
        name: 'global',
        description: 'Global scope',
        active: true,
      });
      expect(component.relatedPermissions.map((p) => p.id)).toEqual([
        'perm-1',
        'perm-2',
      ]);
    });

    it('closes the form and confirm modals', () => {
      const component = create();

      component.openCreateModal();
      component.closeFormModal();
      expect(component.showFormModal).toBe(false);

      component.openDeleteConfirm(scopes[1]);
      component.closeConfirmModal();
      expect(component.showConfirmModal).toBe(false);
    });

    it('stages a delete confirmation with the scope impact', () => {
      const component = create();

      component.openDeleteConfirm(scopes[1]);

      expect(component.currentAppScope).toEqual(scopes[1]);
      expect(component.confirmAction).toBe('delete');
      expect(component.confirmModalTitle).toBe('Confirm App Scope Deletion');
      expect(component.relatedPermissions.map((p) => p.id)).toEqual(['perm-3']);
    });
  });

  describe('validation and confirmation', () => {
    it('requires a name and a description', () => {
      const component = create();

      component.formData = { name: '  ', description: 'x', active: true };
      expect(component.isFormValid()).toBe(false);

      component.formData = { name: 'x', description: ' ', active: true };
      expect(component.isFormValid()).toBe(false);

      component.formData = { name: 'x', description: 'y', active: true };
      expect(component.isFormValid()).toBe(true);
    });

    it('refuses to confirm an invalid form', () => {
      const component = create();

      component.formData = { name: '', description: '', active: true };
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
      component.formData = { name: 'x', description: 'y', active: true };
      component.confirmFormSubmit();
      expect(component.confirmAction).toBe('create');
      expect(component.confirmModalTitle).toBe('Confirm App Scope Creation');

      component.openEditModal(scopes[0]);
      component.confirmFormSubmit();
      expect(component.confirmAction).toBe('update');
      expect(component.confirmModalTitle).toBe('Confirm App Scope Update');
    });

    it('dispatches the staged action', () => {
      const component = create();
      const createSpy = jest.spyOn(component, 'createAppScope');
      const updateSpy = jest.spyOn(component, 'updateAppScope');
      const deleteSpy = jest.spyOn(component, 'deleteAppScope');

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
    it('creates a scope and reloads', () => {
      const component = create();

      component.openCreateModal();
      component.formData = {
        name: 'reports',
        description: 'Reporting scope',
        active: true,
      };
      component.createAppScope();

      expect(appScopesService['createAppScope']).toHaveBeenCalledWith({
        name: 'reports',
        description: 'Reporting scope',
        active: true,
      });
      expect(component.showFormModal).toBe(false);
      expect(appScopesService['getAppScopes']).toHaveBeenCalledTimes(2);
    });

    it('reports a create failure', () => {
      appScopesService['createAppScope'].mockReturnValue(
        throwError(() => new Error('duplicate scope'))
      );
      const component = create();

      component.createAppScope();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'duplicate scope',
        type: 'error',
      });
    });

    it('updates a scope and refreshes the permission relationships', () => {
      const component = create();

      component.openEditModal(scopes[0]);
      component.formData.description = 'Updated scope';
      component.updateAppScope();

      expect(appScopesService['updateAppScope']).toHaveBeenCalledWith(
        'scope-1',
        expect.objectContaining({ description: 'Updated scope' })
      );
      expect(permissionsService.getPermissions).toHaveBeenCalledTimes(2);
      expect(component.showFormModal).toBe(false);
    });

    it('skips the update request without an id', () => {
      const component = create();

      component.openCreateModal();
      component.updateAppScope();

      expect(appScopesService['updateAppScope']).not.toHaveBeenCalled();
    });

    it('reports an update failure', () => {
      appScopesService['updateAppScope'].mockReturnValue(
        throwError(() => ({}))
      );
      const component = create();

      component.openEditModal(scopes[0]);
      component.updateAppScope();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Failed to update app scope.',
        type: 'error',
      });
    });

    it('deletes the staged scope and reloads', () => {
      const component = create();

      component.openDeleteConfirm(scopes[1]);
      component.deleteAppScope();

      expect(appScopesService['deleteAppScope']).toHaveBeenCalledWith(
        'scope-2'
      );
      expect(component.showConfirmModal).toBe(false);
      expect(appScopesService['getAppScopes']).toHaveBeenCalledTimes(2);
    });

    it('skips the delete request when nothing is staged', () => {
      const component = create();

      component.currentAppScope = null;
      component.deleteAppScope();

      expect(appScopesService['deleteAppScope']).not.toHaveBeenCalled();
    });

    it('reports a delete failure', () => {
      appScopesService['deleteAppScope'].mockReturnValue(
        throwError(() => new Error('scope in use'))
      );
      const component = create();

      component.openDeleteConfirm(scopes[0]);
      component.deleteAppScope();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'scope in use',
        type: 'error',
      });
    });
  });
});

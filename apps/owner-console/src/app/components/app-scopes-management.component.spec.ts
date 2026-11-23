import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { AppScopeDto } from '@optimistic-tanuki/ui-models';

import {
  createOwnerConfirmStub,
  OwnerConfirmStub,
} from './owner-confirm.testing';
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
  let lastFixture: ComponentFixture<AppScopesManagementComponent>;
  let confirmStub: OwnerConfirmStub;
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
    confirmStub = createOwnerConfirmStub();
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
        { provide: OwnerConfirmService, useValue: confirmStub },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(AppScopesManagementComponent);
    fixture.detectChanges();
    lastFixture = fixture;
    return fixture.componentInstance;
  };

  const text = () =>
    (lastFixture.nativeElement as HTMLElement).textContent ?? '';

  describe('loading', () => {
    it('counts the permissions attached to each scope', () => {
      const component = create();

      expect(component.appScopes).toHaveLength(2);
      expect(component.permissionCountsMap.get('scope-1')).toBe(2);
      expect(component.permissionCountsMap.get('scope-2')).toBe(1);
    });

    it('shows an empty state, not a message, when no scopes exist', () => {
      appScopesService['getAppScopes'].mockReturnValue(of([]));

      const component = create();

      expect(component.loadError).toBe('');
      expect(text()).toContain('No app scopes exist yet.');
    });

    it('shows Unavailable with the server message when loading fails', () => {
      appScopesService['getAppScopes'].mockReturnValue(
        throwError(() => ({ error: { message: 'Scope service down' } }))
      );

      const component = create();

      expect(component.loading).toBe(false);
      expect(component.loadError).toBe('Scope service down');
      expect(text()).toContain('Unavailable');
    });

    it('falls back to a generic message and retries on demand', () => {
      appScopesService['getAppScopes'].mockReturnValueOnce(
        throwError(() => ({}))
      );

      const component = create();
      expect(component.loadError).toBe(
        'Failed to load app scopes. Please try again.'
      );

      const retry = (lastFixture.nativeElement as HTMLElement).querySelector(
        'ot-owner-state button'
      ) as HTMLButtonElement;
      retry.click();
      lastFixture.detectChanges();

      expect(appScopesService['getAppScopes']).toHaveBeenCalledTimes(2);
      expect(component.loadError).toBe('');
      expect(component.appScopes).toHaveLength(2);
    });

    it('treats a non-array reply as an empty list', () => {
      appScopesService['getAppScopes'].mockReturnValue(
        of({ message: 'x' } as never)
      );

      const component = create();

      expect(component.appScopes).toEqual([]);
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

    it('closes the form modal', () => {
      const component = create();

      component.openCreateModal();
      component.closeFormModal();
      expect(component.showFormModal).toBe(false);
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

    it('refuses to confirm an invalid form', async () => {
      const component = create();

      component.formData = { name: '', description: '', active: true };
      await component.confirmFormSubmit();

      expect(confirmStub.confirm).not.toHaveBeenCalled();
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Please fill in all required fields.',
        type: 'error',
      });
    });

    it('asks for a plain confirmation before creating', async () => {
      const component = create();
      const createSpy = jest.spyOn(component, 'createAppScope');

      component.openCreateModal();
      component.formData = { name: 'x', description: 'y', active: true };
      await component.confirmFormSubmit();

      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'plain' })
      );
      expect(createSpy).toHaveBeenCalled();
    });

    it('asks for a reason before updating', async () => {
      const component = create();
      const updateSpy = jest.spyOn(component, 'updateAppScope');

      component.openEditModal(scopes[0]);
      await component.confirmFormSubmit();

      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'reason', destructive: false })
      );
      expect(updateSpy).toHaveBeenCalled();
    });

    it('marks deactivating a scope as destructive', async () => {
      const component = create();

      component.openEditModal(scopes[0]);
      component.formData.active = false;
      await component.confirmFormSubmit();

      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'reason', destructive: true })
      );
    });

    it('does nothing when the confirmation is declined', async () => {
      confirmStub.confirm.mockResolvedValue({ confirmed: false });
      const component = create();
      const updateSpy = jest.spyOn(component, 'updateAppScope');

      component.openEditModal(scopes[0]);
      await component.confirmFormSubmit();
      await component.openDeleteConfirm(scopes[1]);

      expect(updateSpy).not.toHaveBeenCalled();
      expect(appScopesService['deleteAppScope']).not.toHaveBeenCalled();
    });

    it('requires typing the name before deleting', async () => {
      const component = create();

      await component.openDeleteConfirm(scopes[1]);

      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'typed',
          typedPhrase: 'store',
          destructive: true,
        })
      );
      expect(appScopesService['deleteAppScope']).toHaveBeenCalledWith(
        'scope-2'
      );
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

    it('deletes the confirmed scope and reloads', async () => {
      const component = create();

      await component.openDeleteConfirm(scopes[1]);

      expect(appScopesService['deleteAppScope']).toHaveBeenCalledWith(
        'scope-2'
      );
      expect(appScopesService['getAppScopes']).toHaveBeenCalledTimes(2);
    });

    it('skips the delete request when nothing is staged', () => {
      const component = create();

      component.currentAppScope = null;
      component.deleteAppScope();

      expect(appScopesService['deleteAppScope']).not.toHaveBeenCalled();
    });

    it('reports a delete failure', async () => {
      appScopesService['deleteAppScope'].mockReturnValue(
        throwError(() => new Error('scope in use'))
      );
      const component = create();

      await component.openDeleteConfirm(scopes[0]);

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'scope in use',
        type: 'error',
      });
    });
  });
});

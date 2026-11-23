import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@optimistic-tanuki/common-ui/button/button.component';
import { ModalComponent } from '@optimistic-tanuki/common-ui/modal/modal.component';
import { CheckboxComponent } from '@optimistic-tanuki/form-ui/checkbox/checkbox.component';
import { TextAreaComponent } from '@optimistic-tanuki/form-ui/text-area/text-area.component';
import { TextInputComponent } from '@optimistic-tanuki/form-ui/text-input/text-input.component';
import { MessageComponent } from '@optimistic-tanuki/message-ui/message/message.component';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import {
  AppScopeDto,
  CreateAppScopeDto,
  UpdateAppScopeDto,
  PermissionDto,
} from '@optimistic-tanuki/ui-models';
import {
  OwnerConfirmService,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import { AppScopesService } from '../services/app-scopes.service';
import { PermissionsService } from '../services/permissions.service';
import { AgAppScopesTableComponent } from './ag-app-scopes-table.component';

@Component({
  selector: 'app-app-scopes-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MessageComponent,
    ModalComponent,
    ButtonComponent,
    TextInputComponent,
    TextAreaComponent,
    CheckboxComponent,
    AgAppScopesTableComponent,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './app-scopes-management.component.html',
  styleUrls: ['./app-scopes-management.component.scss'],
})
export class AppScopesManagementComponent implements OnInit {
  private readonly appScopesService = inject(AppScopesService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly messageService = inject(MessageService);
  private readonly confirmService = inject(OwnerConfirmService);

  appScopes: AppScopeDto[] = [];
  permissions: PermissionDto[] = [];
  relatedPermissions: PermissionDto[] = [];
  permissionCountsMap: Map<string, number> = new Map();
  loading = false;
  /** Set when the scope list could not be loaded; shows Unavailable + Retry. */
  loadError = '';

  // Modal states
  showFormModal = false;
  isEditMode = false;
  currentAppScope: AppScopeDto | null = null;

  // Form data
  formData: CreateAppScopeDto & { id?: string } = {
    name: '',
    description: '',
    active: true,
  };

  ngOnInit(): void {
    this.loadAppScopes();
    this.loadPermissions();
  }

  loadAppScopes(): void {
    this.loading = true;
    this.loadError = '';
    this.messageService.clearMessages();

    this.appScopesService.getAppScopes().subscribe({
      next: (appScopes) => {
        this.appScopes = Array.isArray(appScopes) ? appScopes : [];
        this.loading = false;
        this.updatePermissionCounts();
      },
      error: (err) => {
        this.loading = false;
        this.appScopes = [];
        this.loadError =
          err?.error?.message ||
          err?.message ||
          'Failed to load app scopes. Please try again.';
      },
    });
  }

  loadPermissions(): void {
    this.permissionsService.getPermissions().subscribe({
      next: (permissions) => {
        this.permissions = Array.isArray(permissions) ? permissions : [];
        this.updatePermissionCounts();
      },
      error: (err) => {
        console.error('Failed to load permissions:', err);
      },
    });
  }

  updatePermissionCounts(): void {
    this.permissionCountsMap.clear();
    this.appScopes.forEach((scope) => {
      const count = this.getRelatedPermissionsForScope(scope).length;
      this.permissionCountsMap.set(scope.id, count);
    });
  }

  getRelatedPermissionsForScope(scope: AppScopeDto): PermissionDto[] {
    return this.permissions.filter((p) => p.appScope?.id === scope.id);
  }

  // Modal controls
  openCreateModal(): void {
    this.isEditMode = false;
    this.currentAppScope = null;
    this.relatedPermissions = [];
    this.formData = {
      name: '',
      description: '',
      active: true,
    };
    this.showFormModal = true;
  }

  openEditModal(appScope: AppScopeDto): void {
    this.isEditMode = true;
    this.currentAppScope = appScope;
    this.relatedPermissions = this.getRelatedPermissionsForScope(appScope);
    this.formData = {
      id: appScope.id,
      name: appScope.name,
      description: appScope.description,
      active: appScope.active,
    };
    this.showFormModal = true;
  }

  closeFormModal(): void {
    this.showFormModal = false;
  }

  isFormValid(): boolean {
    return !!(this.formData.name?.trim() && this.formData.description?.trim());
  }

  async confirmFormSubmit(): Promise<void> {
    if (!this.isFormValid()) {
      this.messageService.addMessage({
        content: 'Please fill in all required fields.',
        type: 'error',
      });
      return;
    }

    if (!this.isEditMode) {
      const created = await this.confirmService.confirm({
        level: 'plain',
        title: 'Create this app scope',
        body: `Create the app scope ${this.formData.name}?`,
        confirmLabel: 'Create app scope',
      });
      if (created.confirmed) this.createAppScope();
      return;
    }

    const deactivating =
      !this.formData.active && !!this.currentAppScope?.active;
    // Reason is collected in the UI only: the app scopes API accepts none.
    const updated = await this.confirmService.confirm({
      level: 'reason',
      title: 'Save changes to this app scope',
      body: `Updating ${this.formData.name} may affect ${
        this.relatedPermissions.length
      } permission(s) and the roles and users that depend on them.${
        deactivating
          ? ' Deactivating it disables every permission attached to it.'
          : ''
      }`,
      confirmLabel: 'Save changes',
      destructive: deactivating,
    });
    if (updated.confirmed) this.updateAppScope();
  }

  async openDeleteConfirm(appScope: AppScopeDto): Promise<void> {
    this.relatedPermissions = this.getRelatedPermissionsForScope(appScope);
    const result = await this.confirmService.confirm({
      level: 'typed',
      title: 'Delete this app scope',
      body: `Deleting ${appScope.name} cannot be undone. ${this.relatedPermissions.length} permission(s) lose their app scope, which affects every role and user that uses them.`,
      confirmLabel: 'Delete app scope',
      typedPhrase: appScope.name,
      destructive: true,
    });
    if (!result.confirmed) return;
    this.currentAppScope = appScope;
    this.deleteAppScope();
  }

  createAppScope(): void {
    const createDto: CreateAppScopeDto = {
      name: this.formData.name,
      description: this.formData.description,
      active: this.formData.active,
    };

    this.appScopesService.createAppScope(createDto).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'App scope created successfully!',
          type: 'success',
        });
        this.closeFormModal();
        this.loadAppScopes();
      },
      error: (err) => {
        const errorMessage =
          err.error?.message || err.message || 'Failed to create app scope.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error',
        });
      },
    });
  }

  updateAppScope(): void {
    if (!this.formData.id) return;

    const updateDto: UpdateAppScopeDto = {
      name: this.formData.name,
      description: this.formData.description,
      active: this.formData.active,
    };

    this.appScopesService
      .updateAppScope(this.formData.id, updateDto)
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'App scope updated successfully!',
            type: 'success',
          });
          this.closeFormModal();
          this.loadAppScopes();
          this.loadPermissions(); // Reload to get updated relationships
          this.updatePermissionCounts();
        },
        error: (err) => {
          const errorMessage =
            err.error?.message || err.message || 'Failed to update app scope.';
          this.messageService.addMessage({
            content: errorMessage,
            type: 'error',
          });
        },
      });
  }

  deleteAppScope(): void {
    if (!this.currentAppScope) return;

    this.appScopesService.deleteAppScope(this.currentAppScope.id).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'App scope deleted successfully!',
          type: 'success',
        });
        this.loadAppScopes();
        this.loadPermissions(); // Reload to get updated relationships
        this.updatePermissionCounts();
      },
      error: (err) => {
        const errorMessage =
          err.error?.message || err.message || 'Failed to delete app scope.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error',
        });
      },
    });
  }
}

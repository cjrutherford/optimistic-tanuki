import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@optimistic-tanuki/common-ui/button/button.component';
import { ModalComponent } from '@optimistic-tanuki/common-ui/modal/modal.component';
import { MessageComponent } from '@optimistic-tanuki/message-ui/message/message.component';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { TextAreaComponent } from '@optimistic-tanuki/form-ui/text-area/text-area.component';
import { TextInputComponent } from '@optimistic-tanuki/form-ui/text-input/text-input.component';
import {
  PermissionDto,
  CreatePermissionDto,
  UpdatePermissionDto,
  AppScopeDto,
} from '@optimistic-tanuki/ui-models';
import {
  OwnerConfirmService,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import { PermissionsService } from '../services/permissions.service';
import { AppScopesService } from '../services/app-scopes.service';
import { AgPermissionsTableComponent } from './ag-permissions-table.component';

@Component({
  selector: 'app-permissions-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MessageComponent,
    ModalComponent,
    ButtonComponent,
    TextInputComponent,
    TextAreaComponent,
    AgPermissionsTableComponent,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './permissions-management.component.html',
  styleUrls: ['./permissions-management.component.scss'],
})
export class PermissionsManagementComponent implements OnInit {
  private readonly permissionsService = inject(PermissionsService);
  private readonly appScopesService = inject(AppScopesService);
  private readonly messageService = inject(MessageService);
  private readonly confirmService = inject(OwnerConfirmService);

  permissions: PermissionDto[] = [];
  appScopes: AppScopeDto[] = [];
  loading = false;
  /** Set when the permission list could not be loaded; shows Unavailable + Retry. */
  loadError = '';

  // Modal states
  showFormModal = false;
  isEditMode = false;
  currentPermission: PermissionDto | null = null;

  // Form data
  formData: CreatePermissionDto & { id?: string } = {
    name: '',
    description: '',
    resource: '',
    action: '',
    targetId: undefined,
  };

  ngOnInit(): void {
    this.loadPermissions();
    this.loadAppScopes();
  }

  loadPermissions(): void {
    this.loading = true;
    this.loadError = '';
    this.messageService.clearMessages();

    this.permissionsService.getPermissions().subscribe({
      next: (permissions) => {
        this.permissions = Array.isArray(permissions) ? permissions : [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.permissions = [];
        this.loadError =
          err?.error?.message ||
          err?.message ||
          'Failed to load permissions. Please try again.';
      },
    });
  }

  loadAppScopes(): void {
    this.appScopesService.getAppScopes().subscribe({
      next: (appScopes) => {
        this.appScopes = Array.isArray(appScopes) ? appScopes : [];
      },
      error: (err) => {
        console.error('Failed to load app scopes:', err);
      },
    });
  }

  // Modal controls
  openCreateModal(): void {
    this.isEditMode = false;
    this.currentPermission = null;
    this.formData = {
      name: '',
      description: '',
      resource: '',
      action: '',
      targetId: undefined,
    };
    this.showFormModal = true;
  }

  openEditModal(permission: PermissionDto): void {
    this.isEditMode = true;
    this.currentPermission = permission;
    this.formData = {
      id: permission.id,
      name: permission.name,
      description: permission.description,
      resource: permission.resource,
      action: permission.action,
      targetId: permission.targetId,
    };
    this.showFormModal = true;
  }

  closeFormModal(): void {
    this.showFormModal = false;
  }

  isFormValid(): boolean {
    return !!(
      this.formData.name?.trim() &&
      this.formData.description?.trim() &&
      this.formData.resource?.trim() &&
      this.formData.action?.trim()
    );
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
        title: 'Create this permission',
        body: `Create the permission ${this.formData.name}? It grants nothing until a role includes it.`,
        confirmLabel: 'Create permission',
      });
      if (created.confirmed) this.createPermission();
      return;
    }

    // Reason is collected in the UI only: the permissions API accepts none.
    const updated = await this.confirmService.confirm({
      level: 'reason',
      title: 'Save changes to this permission',
      body: `Updating ${this.formData.name} may change access for every role and user that holds it.`,
      confirmLabel: 'Save changes',
    });
    if (updated.confirmed) this.updatePermission();
  }

  async openDeleteConfirm(permission: PermissionDto): Promise<void> {
    const result = await this.confirmService.confirm({
      level: 'typed',
      title: 'Delete this permission',
      body: `Deleting ${permission.name} cannot be undone. Every role that has it loses it.`,
      confirmLabel: 'Delete permission',
      typedPhrase: permission.name,
      destructive: true,
    });
    if (!result.confirmed) return;
    this.currentPermission = permission;
    this.deletePermission();
  }

  createPermission(): void {
    const createDto: CreatePermissionDto = {
      name: this.formData.name,
      description: this.formData.description,
      resource: this.formData.resource,
      action: this.formData.action,
      targetId: this.formData.targetId || undefined,
    };

    this.permissionsService.createPermission(createDto).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'Permission created successfully!',
          type: 'success',
        });
        this.closeFormModal();
        this.loadPermissions();
      },
      error: (err) => {
        const errorMessage =
          err.error?.message || err.message || 'Failed to create permission.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error',
        });
      },
    });
  }

  updatePermission(): void {
    if (!this.formData.id) return;

    const updateDto: UpdatePermissionDto = {
      name: this.formData.name,
      description: this.formData.description,
      resource: this.formData.resource,
      action: this.formData.action,
      targetId: this.formData.targetId || undefined,
    };

    this.permissionsService
      .updatePermission(this.formData.id, updateDto)
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Permission updated successfully!',
            type: 'success',
          });
          this.closeFormModal();
          this.loadPermissions();
        },
        error: (err) => {
          const errorMessage =
            err.error?.message || err.message || 'Failed to update permission.';
          this.messageService.addMessage({
            content: errorMessage,
            type: 'error',
          });
        },
      });
  }

  deletePermission(): void {
    if (!this.currentPermission) return;

    this.permissionsService
      .deletePermission(this.currentPermission.id)
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Permission deleted successfully!',
            type: 'success',
          });
          this.loadPermissions();
        },
        error: (err) => {
          const errorMessage =
            err.error?.message || err.message || 'Failed to delete permission.';
          this.messageService.addMessage({
            content: errorMessage,
            type: 'error',
          });
        },
      });
  }
}

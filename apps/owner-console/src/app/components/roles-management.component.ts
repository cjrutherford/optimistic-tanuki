import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@optimistic-tanuki/common-ui/button/button.component';
import { CardComponent } from '@optimistic-tanuki/common-ui/card/card.component';
import { HeadingComponent } from '@optimistic-tanuki/common-ui/heading/heading.component';
import { ModalComponent } from '@optimistic-tanuki/common-ui/modal/modal.component';
import { MessageComponent } from '@optimistic-tanuki/message-ui/message/message.component';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { TextAreaComponent } from '@optimistic-tanuki/form-ui/text-area/text-area.component';
import { TextInputComponent } from '@optimistic-tanuki/form-ui/text-input/text-input.component';
import {
  RoleDto,
  CreateRoleDto,
  UpdateRoleDto,
  AppScopeDto,
  PermissionDto,
} from '@optimistic-tanuki/ui-models';
import { RolesService } from '../services/roles.service';
import { AppScopesService } from '../services/app-scopes.service';
import { PermissionsService } from '../services/permissions.service';
import { AgRolesTableComponent } from './ag-roles-table.component';

@Component({
  selector: 'app-roles-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    HeadingComponent,
    MessageComponent,
    ModalComponent,
    ButtonComponent,
    TextInputComponent,
    TextAreaComponent,
    AgRolesTableComponent,
  ],
  template: `
    <lib-message></lib-message>

    <otui-card>
      <otui-heading level="2">Roles Management</otui-heading>

      <app-ag-roles-table
        [roles]="roles"
        [loading]="loading"
        (create)="openCreateModal()"
        (edit)="openEditModal($event)"
        (delete)="openDeleteConfirm($event)"
      />
    </otui-card>

    <!-- Create/Edit Modal -->
    <otui-modal
      *ngIf="showFormModal"
      [heading]="isEditMode ? 'Edit Role' : 'Create New Role'"
      (closeModal)="closeFormModal()"
      mode="standard-modal"
      size="lg"
    >
      <div class="form-container">
        <div class="form-section">
          <h3>Role Details</h3>
          <p class="section-description">
            Define the role name, description, and scope.
          </p>

          <div class="form-field">
            <lib-text-input
              label="Role Name *"
              placeholder="e.g., admin, moderator, user"
              [(ngModel)]="formData.name"
            ></lib-text-input>
          </div>

          <div class="form-field">
            <lib-text-area
              label="Description *"
              [(ngModel)]="formData.description"
            ></lib-text-area>
          </div>

          <div class="form-field">
            <lib-text-input
              label="App Scope ID *"
              placeholder="Enter or select app scope ID"
              [(ngModel)]="formData.appScopeId"
            ></lib-text-input>
          </div>

          <div class="form-field" *ngIf="appScopes.length > 0">
            <label class="select-label">Or select App Scope:</label>
            <select class="scope-select" (change)="onAppScopeSelect($event)">
              <option value="">-- Select App Scope --</option>
              <option *ngFor="let scope of appScopes" [value]="scope.id">
                {{ scope.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-preview">
          <h3>Preview</h3>
          <div class="preview-content">
            <p><strong>Name:</strong> {{ formData.name || 'Not set' }}</p>
            <p>
              <strong>Description:</strong>
              {{ formData.description || 'Not set' }}
            </p>
            <p>
              <strong>App Scope ID:</strong>
              {{ formData.appScopeId || 'Not set' }}
            </p>
            <p *ngIf="isEditMode && currentRole" class="info-text">
              <strong>Created:</strong>
              {{ currentRole.created_at | date : 'medium' }}
            </p>
          </div>
        </div>

        <div class="permissions-panel">
          <div class="permissions-header">
            <div>
              <h3>Role Permissions</h3>
              <p class="section-description">
                Attach or remove permissions for this role from the full
                catalog.
              </p>
            </div>
          </div>

          <ng-container
            *ngIf="isEditMode && currentRole; else createModeNotice"
          >
            <div class="permissions-grid">
              <div class="permissions-column">
                <h4>Assigned</h4>
                <div
                  *ngIf="
                    currentRole.permissions?.length;
                    else noAssignedPermissions
                  "
                  class="permission-list"
                >
                  <div
                    *ngFor="let permission of currentRole.permissions"
                    class="permission-card"
                  >
                    <div class="permission-copy">
                      <strong>{{ permission.name }}</strong>
                      <span>{{
                        permission.description || 'No description'
                      }}</span>
                    </div>
                    <otui-button
                      variant="secondary"
                      (action)="removePermission(permission.id)"
                    >
                      Remove
                    </otui-button>
                  </div>
                </div>
                <ng-template #noAssignedPermissions>
                  <p class="empty-state">
                    No permissions are currently attached.
                  </p>
                </ng-template>
              </div>

              <div class="permissions-column">
                <h4>Available</h4>
                <div
                  *ngIf="
                    availablePermissions.length;
                    else noAvailablePermissions
                  "
                  class="permission-list"
                >
                  <div
                    *ngFor="let permission of availablePermissions"
                    class="permission-card"
                  >
                    <div class="permission-copy">
                      <strong>{{ permission.name }}</strong>
                      <span>{{
                        permission.description || 'No description'
                      }}</span>
                    </div>
                    <otui-button
                      variant="primary"
                      (action)="addPermission(permission.id)"
                    >
                      Add
                    </otui-button>
                  </div>
                </div>
                <ng-template #noAvailablePermissions>
                  <p class="empty-state">
                    All loaded permissions are already attached to this role.
                  </p>
                </ng-template>
              </div>
            </div>
          </ng-container>

          <ng-template #createModeNotice>
            <p class="empty-state">
              Save the role first, then reopen it in edit mode to manage
              permissions.
            </p>
          </ng-template>
        </div>

        <div class="form-actions">
          <otui-button variant="secondary" (action)="closeFormModal()">
            Cancel
          </otui-button>
          <otui-button
            variant="primary"
            (action)="confirmFormSubmit()"
            [disabled]="!isFormValid()"
          >
            {{ isEditMode ? 'Update Role' : 'Create Role' }}
          </otui-button>
        </div>
      </div>
    </otui-modal>

    <!-- Confirmation Modal -->
    <otui-modal
      *ngIf="showConfirmModal"
      [heading]="confirmModalTitle"
      (closeModal)="closeConfirmModal()"
      mode="standard-modal"
      size="md"
    >
      <div class="confirm-container">
        <p>{{ confirmModalMessage }}</p>

        <div
          *ngIf="confirmAction === 'create' || confirmAction === 'update'"
          class="change-details"
        >
          <h4>
            Changes to be
            {{ confirmAction === 'create' ? 'applied' : 'saved' }}:
          </h4>
          <ul>
            <li><strong>Name:</strong> {{ formData.name }}</li>
            <li><strong>Description:</strong> {{ formData.description }}</li>
            <li><strong>App Scope ID:</strong> {{ formData.appScopeId }}</li>
          </ul>
          <p class="warning-text" *ngIf="confirmAction === 'update'">
            ⚠️ Updating this role may affect users that have been assigned this
            role.
          </p>
        </div>

        <div
          *ngIf="confirmAction === 'delete' && currentRole"
          class="change-details"
        >
          <h4>Role to be deleted:</h4>
          <ul>
            <li><strong>Name:</strong> {{ currentRole.name }}</li>
            <li><strong>Description:</strong> {{ currentRole.description }}</li>
          </ul>
          <p class="danger-text">
            ⚠️ <strong>This action cannot be undone!</strong> All users with
            this role will lose their permissions.
          </p>
        </div>

        <div class="confirm-actions">
          <otui-button variant="secondary" (action)="closeConfirmModal()">
            Cancel
          </otui-button>
          <otui-button
            [variant]="confirmAction === 'delete' ? 'danger' : 'primary'"
            (action)="executeConfirmedAction()"
          >
            Confirm {{ confirmAction === 'delete' ? 'Delete' : 'Save' }}
          </otui-button>
        </div>
      </div>
    </otui-modal>
  `,
  styles: [
    `
      :host ::ng-deep otui-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      :host {
        display: block;
        padding: 16px;
      }

      .form-container {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        padding: 1rem;
      }

      .form-section {
        flex: 1;
      }

      .form-section h3 {
        margin-bottom: 0.5rem;
      }

      .section-description {
        color: var(--foreground, #666);
        margin-bottom: 1.5rem;
        font-size: 0.9rem;
      }

      .form-field {
        margin-bottom: 1.5rem;
      }

      .select-label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--text-primary);
      }

      .scope-select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        font-size: 14px;
        background: var(--bg-primary);
        color: var(--text-primary);
      }

      .form-preview {
        background: var(--background, #f5f5f5);
        padding: 1.5rem;
        border-radius: 8px;
        border: 1px solid var(--border-color, #ddd);
      }

      .permissions-panel {
        background: var(--background, #f9f9f9);
        padding: 1.5rem;
        border-radius: 8px;
        border: 1px solid var(--border-color, #ddd);
      }

      .permissions-header {
        margin-bottom: 1rem;
      }

      .form-preview h3 {
        margin-bottom: 1rem;
      }

      .permissions-panel h3,
      .permissions-panel h4 {
        margin-bottom: 0.75rem;
      }

      .preview-content p {
        margin-bottom: 0.75rem;
      }

      .permissions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
      }

      .permissions-column {
        display: grid;
        gap: 0.75rem;
      }

      .permission-list {
        display: grid;
        gap: 0.75rem;
      }

      .permission-card {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.875rem 1rem;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 6px;
        background: var(--bg-primary, #fff);
      }

      .permission-copy {
        display: grid;
        gap: 0.25rem;
      }

      .permission-copy span {
        color: var(--foreground, #666);
        font-size: 0.9rem;
      }

      .empty-state {
        margin: 0;
        color: var(--foreground, #666);
        font-size: 0.95rem;
      }

      .info-text {
        color: var(--accent, #007bff);
        font-style: italic;
      }

      .form-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color, #ddd);
      }

      .confirm-container {
        padding: 1rem;
      }

      .confirm-container p {
        margin-bottom: 1.5rem;
      }

      .change-details {
        background: var(--background, #f9f9f9);
        padding: 1rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
      }

      .change-details h4 {
        margin-bottom: 0.75rem;
      }

      .change-details ul {
        list-style: none;
        padding-left: 0;
      }

      .change-details ul li {
        margin-bottom: 0.5rem;
      }

      .warning-text {
        color: var(--warning, #ff9800);
        font-weight: 500;
        margin-top: 1rem;
      }

      .danger-text {
        color: var(--danger, #f44336);
        font-weight: 500;
        margin-top: 1rem;
      }

      .confirm-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
      }
    `,
  ],
})
export class RolesManagementComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly appScopesService = inject(AppScopesService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly messageService = inject(MessageService);

  roles: RoleDto[] = [];
  appScopes: AppScopeDto[] = [];
  permissions: PermissionDto[] = [];
  loading = false;

  showFormModal = false;
  showConfirmModal = false;
  isEditMode = false;
  currentRole: RoleDto | null = null;

  formData: CreateRoleDto & { id?: string } = {
    name: '',
    description: '',
    appScopeId: '',
  };

  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmAction: 'create' | 'update' | 'delete' = 'create';

  get availablePermissions(): PermissionDto[] {
    const assignedIds = new Set(
      (this.currentRole?.permissions ?? []).map((permission) => permission.id)
    );
    return this.permissions.filter(
      (permission) => !assignedIds.has(permission.id)
    );
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadAppScopes();
    this.loadPermissions();
  }

  loadRoles(): void {
    this.loading = true;
    this.messageService.clearMessages();

    this.rolesService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        this.loading = false;

        if (roles.length === 0) {
          this.messageService.addMessage({
            content: 'No roles found in the system.',
            type: 'info',
          });
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMessage =
          err.error?.message ||
          err.message ||
          'Failed to load roles. Please try again.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error',
        });
      },
    });
  }

  loadAppScopes(): void {
    this.appScopesService.getAppScopes().subscribe({
      next: (appScopes) => {
        this.appScopes = appScopes;
      },
      error: (err) => {
        console.error('Failed to load app scopes:', err);
      },
    });
  }

  loadPermissions(): void {
    this.permissionsService.getPermissions().subscribe({
      next: (permissions) => {
        this.permissions = permissions;
      },
      error: (err) => {
        console.error('Failed to load permissions:', err);
      },
    });
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.currentRole = null;
    this.formData = {
      name: '',
      description: '',
      appScopeId: '',
    };
    this.showFormModal = true;
  }

  openEditModal(role: RoleDto): void {
    this.isEditMode = true;
    this.currentRole = {
      ...role,
      permissions: role.permissions ?? [],
    };
    this.formData = {
      id: role.id,
      name: role.name,
      description: role.description,
      appScopeId: role.appScope?.id || '',
    };
    this.showFormModal = true;
    this.refreshCurrentRole();
  }

  closeFormModal(): void {
    this.showFormModal = false;
  }

  addPermission(permissionId: string): void {
    if (!this.currentRole?.id || !this.isEditMode) {
      return;
    }

    this.rolesService
      .addPermissionToRole(this.currentRole.id, permissionId)
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Permission added to role.',
            type: 'success',
          });
          this.refreshCurrentRole();
        },
        error: (err) => {
          const errorMessage =
            err.error?.message || err.message || 'Failed to add permission.';
          this.messageService.addMessage({
            content: errorMessage,
            type: 'error',
          });
        },
      });
  }

  removePermission(permissionId: string): void {
    if (!this.currentRole?.id || !this.isEditMode) {
      return;
    }

    this.rolesService
      .removePermissionFromRole(this.currentRole.id, permissionId)
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Permission removed from role.',
            type: 'success',
          });
          this.refreshCurrentRole();
        },
        error: (err) => {
          const errorMessage =
            err.error?.message || err.message || 'Failed to remove permission.';
          this.messageService.addMessage({
            content: errorMessage,
            type: 'error',
          });
        },
      });
  }

  onAppScopeSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) {
      this.formData.appScopeId = select.value;
    }
  }

  isFormValid(): boolean {
    return !!(
      this.formData.name?.trim() &&
      this.formData.description?.trim() &&
      this.formData.appScopeId?.trim()
    );
  }

  confirmFormSubmit(): void {
    if (!this.isFormValid()) {
      this.messageService.addMessage({
        content: 'Please fill in all required fields.',
        type: 'error',
      });
      return;
    }

    this.confirmAction = this.isEditMode ? 'update' : 'create';
    this.confirmModalTitle = this.isEditMode
      ? 'Confirm Role Update'
      : 'Confirm Role Creation';
    this.confirmModalMessage = this.isEditMode
      ? 'Are you sure you want to update this role?'
      : 'Are you sure you want to create this role?';

    this.showConfirmModal = true;
  }

  openDeleteConfirm(role: RoleDto): void {
    this.currentRole = role;
    this.confirmAction = 'delete';
    this.confirmModalTitle = 'Confirm Role Deletion';
    this.confirmModalMessage = 'Are you sure you want to delete this role?';
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
  }

  executeConfirmedAction(): void {
    if (this.confirmAction === 'create') {
      this.createRole();
    } else if (this.confirmAction === 'update') {
      this.updateRole();
    } else if (this.confirmAction === 'delete') {
      this.deleteRole();
    }
  }

  createRole(): void {
    const createDto: CreateRoleDto = {
      name: this.formData.name,
      description: this.formData.description,
      appScopeId: this.formData.appScopeId,
    };

    this.rolesService.createRole(createDto).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'Role created successfully!',
          type: 'success',
        });
        this.closeConfirmModal();
        this.closeFormModal();
        this.loadRoles();
      },
      error: (err) => {
        const errorMessage =
          err.error?.message || err.message || 'Failed to create role.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error',
        });
      },
    });
  }

  updateRole(): void {
    if (!this.formData.id) return;

    const updateDto: UpdateRoleDto = {
      name: this.formData.name,
      description: this.formData.description,
      appScopeId: this.formData.appScopeId,
    };

    this.rolesService.updateRole(this.formData.id, updateDto).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'Role updated successfully!',
          type: 'success',
        });
        this.closeConfirmModal();
        this.closeFormModal();
        this.loadRoles();
      },
      error: (err) => {
        const errorMessage =
          err.error?.message || err.message || 'Failed to update role.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error',
        });
      },
    });
  }

  private refreshCurrentRole(): void {
    if (!this.currentRole?.id) {
      return;
    }

    this.rolesService.getRole(this.currentRole.id).subscribe({
      next: (role) => {
        this.currentRole = {
          ...role,
          permissions: role.permissions ?? [],
        };
        this.roles = this.roles.map((existingRole) =>
          existingRole.id === role.id ? this.currentRole! : existingRole
        );
      },
      error: (err) => {
        console.error('Failed to refresh role details:', err);
      },
    });
  }

  deleteRole(): void {
    if (!this.currentRole) return;

    this.rolesService.deleteRole(this.currentRole.id).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'Role deleted successfully!',
          type: 'success',
        });
        this.closeConfirmModal();
        this.loadRoles();
      },
      error: (err) => {
        const errorMessage =
          err.error?.message || err.message || 'Failed to delete role.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error',
        });
      },
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent, TableComponent, TableCell, TableRowAction, HeadingComponent, ModalComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { MessageComponent, MessageService } from '@optimistic-tanuki/message-ui';
import { TextInputComponent, TextAreaComponent } from '@optimistic-tanuki/form-ui';
import { PermissionDto, CreatePermissionDto, UpdatePermissionDto, AppScopeDto } from '@optimistic-tanuki/ui-models';
import { PermissionsService } from '../services/permissions.service';
import { AppScopesService } from '../services/app-scopes.service';

@Component({
  selector: 'app-permissions-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    TableComponent,
    HeadingComponent,
    MessageComponent,
    ModalComponent,
    ButtonComponent,
    TextInputComponent,
    TextAreaComponent,
  ],
  template: `
    <lib-message></lib-message>
    
    <otui-card>
      <otui-heading level="2">Permissions Management</otui-heading>

      <div class="action-bar">
        <otui-button variant="primary" (action)="openCreateModal()">
          Create New Permission
        </otui-button>
      </div>

      <div *ngIf="loading" class="loading-message">Loading permissions...</div>

      <div *ngFor="let perm of permissions" class="perm-row">
        <otui-table
          [cells]="getPermissionCells(perm)"
          [rowIndex]="permissions.indexOf(perm)"
          [rowActions]="getPermissionActions(perm)"
        ></otui-table>
      </div>
    </otui-card>

    <!-- Create/Edit Modal -->
    <otui-modal
      *ngIf="showFormModal"
      [heading]="isEditMode ? 'Edit Permission' : 'Create New Permission'"
      (closeModal)="closeFormModal()"
      mode="standard-modal"
      size="lg"
    >
      <div class="form-container">
        <div class="form-section">
          <h3>Permission Details</h3>
          <p class="section-description">Define the permission name, description, and scope.</p>
          
          <div class="form-field">
            <lib-text-input
              label="Permission Name *"
              placeholder="e.g., manage_users"
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
              label="Resource *"
              placeholder="e.g., users, posts, profiles"
              [(ngModel)]="formData.resource"
            ></lib-text-input>
          </div>

          <div class="form-field">
            <lib-text-input
              label="Action *"
              placeholder="e.g., read, write, delete, manage"
              [(ngModel)]="formData.action"
            ></lib-text-input>
          </div>

          <div class="form-field">
            <lib-text-input
              label="Target ID (optional)"
              placeholder="e.g., profile ID for profile-specific permissions"
              [(ngModel)]="formData.targetId"
            ></lib-text-input>
          </div>
        </div>

        <div class="form-preview">
          <h3>Preview</h3>
          <div class="preview-content">
            <p><strong>Name:</strong> {{ formData.name || 'Not set' }}</p>
            <p><strong>Description:</strong> {{ formData.description || 'Not set' }}</p>
            <p><strong>Resource:</strong> {{ formData.resource || 'Not set' }}</p>
            <p><strong>Action:</strong> {{ formData.action || 'Not set' }}</p>
            <p><strong>Target ID:</strong> {{ formData.targetId || 'None (applies globally)' }}</p>
            <p *ngIf="isEditMode && currentPermission" class="info-text">
              <strong>Current App Scope:</strong> {{ currentPermission.appScope?.name || 'None' }}
            </p>
          </div>
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
            {{ isEditMode ? 'Update Permission' : 'Create Permission' }}
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
        
        <div *ngIf="confirmAction === 'create' || confirmAction === 'update'" class="change-details">
          <h4>Changes to be {{ confirmAction === 'create' ? 'applied' : 'saved' }}:</h4>
          <ul>
            <li><strong>Name:</strong> {{ formData.name }}</li>
            <li><strong>Description:</strong> {{ formData.description }}</li>
            <li><strong>Resource:</strong> {{ formData.resource }}</li>
            <li><strong>Action:</strong> {{ formData.action }}</li>
            <li><strong>Target ID:</strong> {{ formData.targetId || 'None' }}</li>
          </ul>
          <p class="warning-text" *ngIf="confirmAction === 'update'">
            ⚠️ Updating this permission may affect roles and users that have been granted this permission.
          </p>
        </div>

        <div *ngIf="confirmAction === 'delete' && currentPermission" class="change-details">
          <h4>Permission to be deleted:</h4>
          <ul>
            <li><strong>Name:</strong> {{ currentPermission.name }}</li>
            <li><strong>Description:</strong> {{ currentPermission.description }}</li>
            <li><strong>Resource:</strong> {{ currentPermission.resource }}</li>
            <li><strong>Action:</strong> {{ currentPermission.action }}</li>
          </ul>
          <p class="danger-text">
            ⚠️ <strong>This action cannot be undone!</strong> All roles with this permission will lose it.
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
      .action-bar {
        margin-bottom: 1.5rem;
        display: flex;
        justify-content: flex-end;
      }

      .loading-message {
        padding: 2rem;
        text-align: center;
      }

      .perm-row {
        margin-bottom: 0.5rem;
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

      .form-preview {
        background: var(--background, #f5f5f5);
        padding: 1.5rem;
        border-radius: 8px;
        border: 1px solid var(--border-color, #ddd);
      }

      .form-preview h3 {
        margin-bottom: 1rem;
      }

      .preview-content p {
        margin-bottom: 0.75rem;
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
export class PermissionsManagementComponent implements OnInit {
  permissions: PermissionDto[] = [];
  appScopes: AppScopeDto[] = [];
  loading = false;

  // Modal states
  showFormModal = false;
  showConfirmModal = false;
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

  // Confirmation modal
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmAction: 'create' | 'update' | 'delete' = 'create';

  constructor(
    private permissionsService: PermissionsService,
    private appScopesService: AppScopesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadPermissions();
    this.loadAppScopes();
  }

  loadPermissions(): void {
    this.loading = true;
    this.messageService.clearMessages();
    
    this.permissionsService.getPermissions().subscribe({
      next: (permissions) => {
        this.permissions = permissions;
        this.loading = false;
        
        if (permissions.length === 0) {
          this.messageService.addMessage({
            content: 'No permissions found in the system.',
            type: 'info'
          });
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMessage = err.error?.message || err.message || 'Failed to load permissions. Please try again.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
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

  getPermissionCells(perm: PermissionDto): TableCell[] {
    return [
      { heading: 'Name', value: perm.name },
      { heading: 'Description', value: perm.description },
      { heading: 'Resource', value: perm.resource },
      { heading: 'Action', value: perm.action },
      { heading: 'App Scope', value: perm.appScope?.name || 'None' },
      { heading: 'Target ID', value: perm.targetId || 'Global' },
    ];
  }

  getPermissionActions(perm: PermissionDto): TableRowAction[] {
    return [
      {
        title: 'Edit',
        action: () => this.openEditModal(perm),
      },
      {
        title: 'Delete',
        action: () => this.openDeleteConfirm(perm),
      },
    ];
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

  confirmFormSubmit(): void {
    if (!this.isFormValid()) {
      this.messageService.addMessage({
        content: 'Please fill in all required fields.',
        type: 'error'
      });
      return;
    }

    this.confirmAction = this.isEditMode ? 'update' : 'create';
    this.confirmModalTitle = this.isEditMode ? 'Confirm Permission Update' : 'Confirm Permission Creation';
    this.confirmModalMessage = this.isEditMode
      ? 'Are you sure you want to update this permission?'
      : 'Are you sure you want to create this permission?';
    
    this.showConfirmModal = true;
  }

  openDeleteConfirm(permission: PermissionDto): void {
    this.currentPermission = permission;
    this.confirmAction = 'delete';
    this.confirmModalTitle = 'Confirm Permission Deletion';
    this.confirmModalMessage = 'Are you sure you want to delete this permission?';
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
  }

  executeConfirmedAction(): void {
    if (this.confirmAction === 'create') {
      this.createPermission();
    } else if (this.confirmAction === 'update') {
      this.updatePermission();
    } else if (this.confirmAction === 'delete') {
      this.deletePermission();
    }
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
          type: 'success'
        });
        this.closeConfirmModal();
        this.closeFormModal();
        this.loadPermissions();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Failed to create permission.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
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

    this.permissionsService.updatePermission(this.formData.id, updateDto).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'Permission updated successfully!',
          type: 'success'
        });
        this.closeConfirmModal();
        this.closeFormModal();
        this.loadPermissions();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Failed to update permission.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
        });
      },
    });
  }

  deletePermission(): void {
    if (!this.currentPermission) return;

    this.permissionsService.deletePermission(this.currentPermission.id).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'Permission deleted successfully!',
          type: 'success'
        });
        this.closeConfirmModal();
        this.loadPermissions();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Failed to delete permission.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
        });
      },
    });
  }
}

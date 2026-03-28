import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CardComponent,
  HeadingComponent,
  ModalComponent,
  ButtonComponent,
} from '@optimistic-tanuki/common-ui';
import {
  MessageComponent,
  MessageService,
} from '@optimistic-tanuki/message-ui';
import {
  TextInputComponent,
  TextAreaComponent,
} from '@optimistic-tanuki/form-ui';
import {
  RoleDto,
  CreateRoleDto,
  UpdateRoleDto,
  AppScopeDto,
} from '@optimistic-tanuki/ui-models';
import { RolesService, RoleAssignmentDto } from '../services/roles.service';
import { AppScopesService } from '../services/app-scopes.service';
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

    <div class="tabs">
      <button
        class="tab-button"
        [class.active]="activeTab === 'roles'"
        (click)="switchTab('roles')"
      >
        Roles
      </button>
      <button
        class="tab-button"
        [class.active]="activeTab === 'assignments'"
        (click)="switchTab('assignments')"
      >
        Role Assignments
      </button>
    </div>

    <otui-card *ngIf="activeTab === 'roles'">
      <otui-heading level="2">Roles Management</otui-heading>

      <app-ag-roles-table
        [roles]="roles"
        [loading]="loading"
        (create)="openCreateModal()"
        (edit)="openEditModal($event)"
        (delete)="openDeleteConfirm($event)"
      />
    </otui-card>

    <otui-card *ngIf="activeTab === 'assignments'">
      <otui-heading level="2">Role Assignments</otui-heading>

      <div class="filters">
        <label>Filter by App Scope:</label>
        <select [(ngModel)]="filterAppScopeId" (change)="loadAssignments()">
          <option value="">All Scopes</option>
          <option *ngFor="let scope of appScopes" [value]="scope.id">
            {{ scope.name }}
          </option>
        </select>
        <otui-button variant="secondary" (action)="loadAssignments()">
          Refresh
        </otui-button>
      </div>

      <div class="assignments-table" *ngIf="!loadingAssignments">
        <table>
          <thead>
            <tr>
              <th>Profile ID</th>
              <th>Role</th>
              <th>App Scope</th>
              <th>Target ID</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let assignment of roleAssignments">
              <td>{{ assignment.profileId }}</td>
              <td>{{ assignment.role?.name }}</td>
              <td>{{ assignment.appScope?.name }}</td>
              <td>{{ assignment.targetId || '-' }}</td>
              <td>{{ assignment.created_at | date : 'short' }}</td>
              <td>
                <otui-button
                  variant="danger"
                  size="small"
                  (action)="unassignRole(assignment)"
                >
                  Remove
                </otui-button>
              </td>
            </tr>
            <tr *ngIf="roleAssignments.length === 0">
              <td colspan="6" class="empty-message">
                No role assignments found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="loadingAssignments" class="loading">
        Loading assignments...
      </div>
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

      .tabs {
        display: flex;
        gap: 0;
        margin-bottom: 16px;
        border-bottom: 2px solid var(--border-color, #ddd);
      }

      .tab-button {
        padding: 12px 24px;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary, #666);
        transition: all 0.2s;
      }

      .tab-button:hover {
        color: var(--text-primary, #333);
      }

      .tab-button.active {
        color: var(--accent, #007bff);
        border-bottom-color: var(--accent, #007bff);
      }

      .filters {
        display: flex;
        gap: 16px;
        align-items: center;
        margin-bottom: 16px;
        padding: 12px;
        background: var(--background, #f5f5f5);
        border-radius: 6px;
      }

      .filters select {
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        font-size: 14px;
        background: var(--bg-primary);
        color: var(--text-primary);
        min-width: 200px;
      }

      .assignments-table {
        overflow-x: auto;
      }

      .assignments-table table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      .assignments-table th,
      .assignments-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--border-color, #ddd);
      }

      .assignments-table th {
        background: var(--background, #f5f5f5);
        font-weight: 600;
        color: var(--text-primary);
      }

      .assignments-table tr:hover {
        background: var(--background, #fafafa);
      }

      .empty-message {
        text-align: center;
        color: var(--text-secondary, #666);
        padding: 24px !important;
      }

      .loading {
        text-align: center;
        padding: 24px;
        color: var(--text-secondary, #666);
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
export class RolesManagementComponent implements OnInit {
  roles: RoleDto[] = [];
  appScopes: AppScopeDto[] = [];
  loading = false;
  activeTab: 'roles' | 'assignments' = 'roles';

  roleAssignments: RoleAssignmentDto[] = [];
  loadingAssignments = false;
  filterAppScopeId = '';

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

  constructor(
    private rolesService: RolesService,
    private appScopesService: AppScopesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadRoles();
    this.loadAppScopes();
  }

  switchTab(tab: 'roles' | 'assignments'): void {
    this.activeTab = tab;
    if (tab === 'assignments' && this.roleAssignments.length === 0) {
      this.loadAssignments();
    }
  }

  loadAssignments(): void {
    this.loadingAssignments = true;
    this.rolesService
      .getAllAssignments(this.filterAppScopeId || undefined)
      .subscribe({
        next: (assignments) => {
          this.roleAssignments = assignments;
          this.loadingAssignments = false;
        },
        error: (err) => {
          this.loadingAssignments = false;
          this.messageService.addMessage({
            content: 'Failed to load role assignments.',
            type: 'error',
          });
        },
      });
  }

  unassignRole(assignment: RoleAssignmentDto): void {
    if (
      confirm(
        `Remove role "${assignment.role?.name}" from profile ${assignment.profileId}?`
      )
    ) {
      this.rolesService.unassignRole(assignment.id).subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Role assignment removed successfully.',
            type: 'success',
          });
          this.loadAssignments();
        },
        error: (err) => {
          this.messageService.addMessage({
            content: 'Failed to remove role assignment.',
            type: 'error',
          });
        },
      });
    }
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
    this.currentRole = role;
    this.formData = {
      id: role.id,
      name: role.name,
      description: role.description,
      appScopeId: role.appScope?.id || '',
    };
    this.showFormModal = true;
  }

  closeFormModal(): void {
    this.showFormModal = false;
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

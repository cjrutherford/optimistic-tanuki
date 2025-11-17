import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent, TableComponent, TableCell, TableRowAction, HeadingComponent, ModalComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { MessageComponent, MessageService } from '@optimistic-tanuki/message-ui';
import { TextInputComponent, TextAreaComponent, CheckboxComponent } from '@optimistic-tanuki/form-ui';
import { AppScopeDto, CreateAppScopeDto, UpdateAppScopeDto, PermissionDto } from '@optimistic-tanuki/ui-models';
import { AppScopesService } from '../services/app-scopes.service';
import { PermissionsService } from '../services/permissions.service';

@Component({
  selector: 'app-app-scopes-management',
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
    CheckboxComponent,
  ],
  template: `
    <lib-message></lib-message>
    
    <otui-card>
      <otui-heading level="2">App Scopes Management</otui-heading>

      <div class="action-bar">
        <otui-button variant="primary" (action)="openCreateModal()">
          Create New App Scope
        </otui-button>
      </div>

      <div *ngIf="loading" class="loading-message">Loading app scopes...</div>

      <div *ngFor="let scope of appScopes" class="scope-row">
        <otui-table
          [cells]="getAppScopeCells(scope)"
          [rowIndex]="appScopes.indexOf(scope)"
          [rowActions]="getAppScopeActions(scope)"
        ></otui-table>
      </div>
    </otui-card>

    <!-- Create/Edit Modal -->
    <otui-modal
      *ngIf="showFormModal"
      [heading]="isEditMode ? 'Edit App Scope' : 'Create New App Scope'"
      (closeModal)="closeFormModal()"
      mode="standard-modal"
      size="lg"
    >
      <div class="form-container">
        <div class="form-section">
          <h3>App Scope Details</h3>
          <p class="section-description">Define the application scope name, description, and status.</p>
          
          <div class="form-field">
            <lib-text-input
              label="App Scope Name *"
              placeholder="e.g., owner-console, social-app, blog-service"
              [(ngModel)]="formData.name"
            ></lib-text-input>
          </div>

          <div class="form-field">
            <lib-text-area
              label="Description *"
              [(ngModel)]="formData.description"
            ></lib-text-area>
          </div>

          <div class="form-field checkbox-field">
            <lib-checkbox
              [value]="formData.active"
              (changeEvent)="formData.active = $event"
            ></lib-checkbox>
            <label>Active (when checked, this app scope is enabled)</label>
          </div>
        </div>

        <div class="form-preview">
          <h3>Preview</h3>
          <div class="preview-content">
            <p><strong>Name:</strong> {{ formData.name || 'Not set' }}</p>
            <p><strong>Description:</strong> {{ formData.description || 'Not set' }}</p>
            <p><strong>Status:</strong> 
              <span [class.active-badge]="formData.active" [class.inactive-badge]="!formData.active">
                {{ formData.active ? 'Active' : 'Inactive' }}
              </span>
            </p>
            <div *ngIf="isEditMode && currentAppScope" class="related-info">
              <p class="info-text"><strong>Related Permissions:</strong></p>
              <p *ngIf="relatedPermissions.length === 0" class="muted-text">No permissions associated with this app scope.</p>
              <ul *ngIf="relatedPermissions.length > 0">
                <li *ngFor="let perm of relatedPermissions">{{ perm.name }} ({{ perm.resource }}.{{ perm.action }})</li>
              </ul>
            </div>
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
            {{ isEditMode ? 'Update App Scope' : 'Create App Scope' }}
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
            <li><strong>Status:</strong> {{ formData.active ? 'Active' : 'Inactive' }}</li>
          </ul>
          <p class="warning-text" *ngIf="confirmAction === 'update'">
            ⚠️ Updating this app scope may affect {{ relatedPermissions.length }} permission(s) and associated roles.
          </p>
          <div *ngIf="confirmAction === 'update' && !formData.active && currentAppScope?.active" class="warning-box">
            <p class="danger-text">
              <strong>⚠️ Warning:</strong> Deactivating this app scope will affect:
            </p>
            <ul>
              <li>{{ relatedPermissions.length }} permission(s) associated with this scope</li>
              <li>All roles that use these permissions</li>
              <li>All users with these roles</li>
            </ul>
          </div>
        </div>

        <div *ngIf="confirmAction === 'delete' && currentAppScope" class="change-details">
          <h4>App Scope to be deleted:</h4>
          <ul>
            <li><strong>Name:</strong> {{ currentAppScope.name }}</li>
            <li><strong>Description:</strong> {{ currentAppScope.description }}</li>
            <li><strong>Status:</strong> {{ currentAppScope.active ? 'Active' : 'Inactive' }}</li>
          </ul>
          <div class="danger-box">
            <p class="danger-text">
              <strong>⚠️ This action cannot be undone!</strong>
            </p>
            <p>Deleting this app scope will affect:</p>
            <ul>
              <li>{{ relatedPermissions.length }} permission(s) will lose their app scope association</li>
              <li>All roles using these permissions</li>
              <li>All users with these roles</li>
            </ul>
          </div>
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

      .action-bar {
        margin-bottom: 1.5rem;
        display: flex;
        justify-content: flex-end;
      }

      .loading-message {
        padding: 2rem;
        text-align: center;
      }

      .scope-row {
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

      .checkbox-field {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .checkbox-field label {
        cursor: pointer;
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

      .active-badge {
        color: var(--success, #4caf50);
        font-weight: 600;
      }

      .inactive-badge {
        color: var(--warning, #ff9800);
        font-weight: 600;
      }

      .related-info {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color, #ddd);
      }

      .related-info ul {
        list-style: disc;
        padding-left: 1.5rem;
        margin-top: 0.5rem;
      }

      .related-info ul li {
        margin-bottom: 0.25rem;
        font-size: 0.9rem;
      }

      .info-text {
        color: var(--accent, #007bff);
        font-weight: 500;
      }

      .muted-text {
        color: var(--foreground, #999);
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
      }

      .warning-box,
      .danger-box {
        background: rgba(255, 152, 0, 0.1);
        border: 1px solid var(--warning, #ff9800);
        padding: 1rem;
        border-radius: 6px;
        margin-top: 1rem;
      }

      .danger-box {
        background: rgba(244, 67, 54, 0.1);
        border-color: var(--danger, #f44336);
      }

      .danger-box ul {
        list-style: disc;
        padding-left: 1.5rem;
        margin-top: 0.5rem;
      }

      .confirm-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
      }
    `,
  ],
})
export class AppScopesManagementComponent implements OnInit {
  appScopes: AppScopeDto[] = [];
  permissions: PermissionDto[] = [];
  relatedPermissions: PermissionDto[] = [];
  loading = false;

  // Modal states
  showFormModal = false;
  showConfirmModal = false;
  isEditMode = false;
  currentAppScope: AppScopeDto | null = null;

  // Form data
  formData: CreateAppScopeDto & { id?: string } = {
    name: '',
    description: '',
    active: true,
  };

  // Confirmation modal
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmAction: 'create' | 'update' | 'delete' = 'create';

  constructor(
    private appScopesService: AppScopesService,
    private permissionsService: PermissionsService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadAppScopes();
    this.loadPermissions();
  }

  loadAppScopes(): void {
    this.loading = true;
    this.messageService.clearMessages();
    
    this.appScopesService.getAppScopes().subscribe({
      next: (appScopes) => {
        this.appScopes = appScopes;
        this.loading = false;
        
        if (appScopes.length === 0) {
          this.messageService.addMessage({
            content: 'No app scopes found in the system.',
            type: 'info'
          });
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMessage = err.error?.message || err.message || 'Failed to load app scopes. Please try again.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
        });
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

  getAppScopeCells(scope: AppScopeDto): TableCell[] {
    const relatedPerms = this.getRelatedPermissionsForScope(scope);
    return [
      { heading: 'Name', value: scope.name },
      { heading: 'Description', value: scope.description },
      { heading: 'Status', value: scope.active ? 'Active' : 'Inactive', isBadge: true },
      { heading: 'Permissions', value: `${relatedPerms.length} permission(s)` },
    ];
  }

  getAppScopeActions(scope: AppScopeDto): TableRowAction[] {
    return [
      {
        title: 'Edit',
        action: () => this.openEditModal(scope),
      },
      {
        title: 'Delete',
        action: () => this.openDeleteConfirm(scope),
      },
    ];
  }

  getRelatedPermissionsForScope(scope: AppScopeDto): PermissionDto[] {
    return this.permissions.filter(p => p.appScope?.id === scope.id);
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
    return !!(
      this.formData.name?.trim() &&
      this.formData.description?.trim()
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
    this.confirmModalTitle = this.isEditMode ? 'Confirm App Scope Update' : 'Confirm App Scope Creation';
    this.confirmModalMessage = this.isEditMode
      ? 'Are you sure you want to update this app scope?'
      : 'Are you sure you want to create this app scope?';
    
    this.showConfirmModal = true;
  }

  openDeleteConfirm(appScope: AppScopeDto): void {
    this.currentAppScope = appScope;
    this.relatedPermissions = this.getRelatedPermissionsForScope(appScope);
    this.confirmAction = 'delete';
    this.confirmModalTitle = 'Confirm App Scope Deletion';
    this.confirmModalMessage = 'Are you sure you want to delete this app scope?';
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
  }

  executeConfirmedAction(): void {
    if (this.confirmAction === 'create') {
      this.createAppScope();
    } else if (this.confirmAction === 'update') {
      this.updateAppScope();
    } else if (this.confirmAction === 'delete') {
      this.deleteAppScope();
    }
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
          type: 'success'
        });
        this.closeConfirmModal();
        this.closeFormModal();
        this.loadAppScopes();
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Failed to create app scope.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
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

    this.appScopesService.updateAppScope(this.formData.id, updateDto).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'App scope updated successfully!',
          type: 'success'
        });
        this.closeConfirmModal();
        this.closeFormModal();
        this.loadAppScopes();
        this.loadPermissions(); // Reload to get updated relationships
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Failed to update app scope.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
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
          type: 'success'
        });
        this.closeConfirmModal();
        this.loadAppScopes();
        this.loadPermissions(); // Reload to get updated relationships
      },
      error: (err) => {
        const errorMessage = err.error?.message || err.message || 'Failed to delete app scope.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
        });
      },
    });
  }
}

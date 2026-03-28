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
  ProfileDto,
  RoleDto,
  AppScopeDto,
  UserRoleDto,
} from '@optimistic-tanuki/ui-models';
import { UsersService } from '../services/users.service';
import { RolesService } from '../services/roles.service';
import { AppScopesService } from '../services/app-scopes.service';
import { AgUsersTableComponent } from './ag-users-table.component';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    HeadingComponent,
    ModalComponent,
    ButtonComponent,
    MessageComponent,
    AgUsersTableComponent,
  ],
  template: `
    <lib-message></lib-message>

    <otui-card>
      <otui-heading level="2">Users Management</otui-heading>

      <app-ag-users-table
        [users]="users"
        [loading]="loading"
        (manageRoles)="onManageRoles($event)"
      />
    </otui-card>

    <!-- Role Management Modal -->
    <otui-modal
      *ngIf="showRoleModal"
      [heading]="'Manage Roles - ' + selectedUser?.profileName"
      (closeModal)="closeRoleModal()"
      mode="standard-modal"
      size="lg"
    >
      <div class="role-modal-content">
        <div class="current-roles">
          <h3>Current Roles</h3>
          <div *ngIf="userRoles.length === 0" class="no-roles">
            No roles assigned to this user.
          </div>
          <div class="role-list">
            <div *ngFor="let role of userRoles" class="role-item">
              <div class="role-info">
                <span class="role-name">{{ role.role?.name }}</span>
                <span class="role-scope">{{ role.appScope?.name }}</span>
              </div>
              <otui-button
                variant="danger"
                size="small"
                (action)="removeRole(role)"
              >
                Remove
              </otui-button>
            </div>
          </div>
        </div>

        <div class="add-role">
          <h3>Add Role</h3>
          <div class="add-role-form">
            <div class="form-field">
              <label>Select Role:</label>
              <select [(ngModel)]="newRoleId">
                <option value="">-- Select Role --</option>
                <option *ngFor="let role of availableRoles" [value]="role.id">
                  {{ role.name }}
                </option>
              </select>
            </div>
            <div class="form-field">
              <label>App Scope:</label>
              <select [(ngModel)]="newAppScopeId">
                <option value="">-- Select Scope --</option>
                <option *ngFor="let scope of appScopes" [value]="scope.id">
                  {{ scope.name }}
                </option>
              </select>
            </div>
            <otui-button
              variant="primary"
              (action)="addRole()"
              [disabled]="!newRoleId || !newAppScopeId"
            >
              Add Role
            </otui-button>
          </div>
        </div>
      </div>
    </otui-modal>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 16px;
      }

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

      .role-modal-content {
        padding: 1rem;
        max-height: 70vh;
        overflow-y: auto;
      }

      .current-roles {
        margin-bottom: 2rem;
      }

      .current-roles h3,
      .add-role h3 {
        margin-bottom: 1rem;
        color: var(--text-primary);
      }

      .no-roles {
        color: var(--text-secondary, #666);
        font-style: italic;
        padding: 1rem;
        background: var(--background, #f5f5f5);
        border-radius: 6px;
      }

      .role-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .role-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        background: var(--background, #f5f5f5);
        border-radius: 6px;
        border: 1px solid var(--border-color, #ddd);
      }

      .role-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .role-name {
        font-weight: 600;
        color: var(--text-primary);
      }

      .role-scope {
        font-size: 0.85rem;
        color: var(--text-secondary, #666);
      }

      .add-role-form {
        display: flex;
        gap: 1rem;
        align-items: flex-end;
        flex-wrap: wrap;
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .form-field label {
        font-weight: 500;
        color: var(--text-primary);
        font-size: 0.9rem;
      }

      .form-field select {
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        font-size: 14px;
        background: var(--bg-primary);
        color: var(--text-primary);
        min-width: 180px;
      }
    `,
  ],
})
export class UsersManagementComponent implements OnInit {
  users: ProfileDto[] = [];
  loading = false;

  showRoleModal = false;
  selectedUser: ProfileDto | null = null;
  userRoles: UserRoleDto[] = [];
  availableRoles: RoleDto[] = [];
  appScopes: AppScopeDto[] = [];
  newRoleId = '';
  newAppScopeId = '';

  constructor(
    private usersService: UsersService,
    private rolesService: RolesService,
    private appScopesService: AppScopesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
    this.loadAppScopes();
  }

  loadUsers(): void {
    this.loading = true;
    this.messageService.clearMessages();

    this.usersService.getProfiles().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;

        if (users.length === 0) {
          this.messageService.addMessage({
            content: 'No users found in the system.',
            type: 'info',
          });
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMessage =
          err.error?.message ||
          err.message ||
          'Failed to load users. Please try again.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error',
        });
      },
    });
  }

  loadRoles(): void {
    this.rolesService.getRoles().subscribe({
      next: (roles) => {
        this.availableRoles = roles;
      },
      error: (err) => {
        console.error('Failed to load roles:', err);
      },
    });
  }

  loadAppScopes(): void {
    this.appScopesService.getAppScopes().subscribe({
      next: (scopes) => {
        this.appScopes = scopes;
      },
      error: (err) => {
        console.error('Failed to load app scopes:', err);
      },
    });
  }

  onManageRoles(user: ProfileDto): void {
    this.selectedUser = user;
    this.showRoleModal = true;
    this.loadUserRoles();
  }

  closeRoleModal(): void {
    this.showRoleModal = false;
    this.selectedUser = null;
    this.userRoles = [];
    this.newRoleId = '';
    this.newAppScopeId = '';
  }

  loadUserRoles(): void {
    if (!this.selectedUser) return;

    this.rolesService.getUserRoles(this.selectedUser.id).subscribe({
      next: (roles) => {
        this.userRoles = roles;
      },
      error: (err) => {
        this.messageService.addMessage({
          content: 'Failed to load user roles.',
          type: 'error',
        });
      },
    });
  }

  addRole(): void {
    if (!this.selectedUser || !this.newRoleId || !this.newAppScopeId) {
      return;
    }

    this.rolesService
      .assignRole({
        profileId: this.selectedUser.id,
        roleId: this.newRoleId,
        appScopeId: this.newAppScopeId,
      })
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Role assigned successfully!',
            type: 'success',
          });
          this.newRoleId = '';
          this.newAppScopeId = '';
          this.loadUserRoles();
        },
        error: (err) => {
          this.messageService.addMessage({
            content: 'Failed to assign role.',
            type: 'error',
          });
        },
      });
  }

  removeRole(userRole: UserRoleDto): void {
    if (!userRole.id) {
      this.messageService.addMessage({
        content: 'Invalid role assignment.',
        type: 'error',
      });
      return;
    }

    if (confirm(`Remove role "${userRole.role?.name}" from this user?`)) {
      this.rolesService.unassignRole(userRole.id).subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Role removed successfully!',
            type: 'success',
          });
          this.loadUserRoles();
        },
        error: (err) => {
          this.messageService.addMessage({
            content: 'Failed to remove role.',
            type: 'error',
          });
        },
      });
    }
  }
}

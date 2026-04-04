import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ButtonComponent } from '@optimistic-tanuki/common-ui/button/button.component';
import { CardComponent } from '@optimistic-tanuki/common-ui/card/card.component';
import { HeadingComponent } from '@optimistic-tanuki/common-ui/heading/heading.component';
import { ModalComponent } from '@optimistic-tanuki/common-ui/modal/modal.component';
import { MessageComponent } from '@optimistic-tanuki/message-ui/message/message.component';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { ProfileDto, RoleDto, UserRoleDto } from '@optimistic-tanuki/ui-models';
import { UsersService } from '../services/users.service';
import { RolesService } from '../services/roles.service';
import { AgUsersTableComponent } from './ag-users-table.component';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    CardComponent,
    HeadingComponent,
    MessageComponent,
    ModalComponent,
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

    <otui-modal
      *ngIf="showRoleModal"
      [heading]="roleModalHeading"
      (closeModal)="closeRoleModal()"
      mode="standard-modal"
      size="lg"
    >
      <div class="role-modal">
        <div class="role-panel">
          <h3>Assigned Roles</h3>
          <p class="panel-copy">
            Remove roles that should no longer apply to this profile.
          </p>

          <div *ngIf="roleManagementLoading" class="empty-state">Loading role assignments...</div>
          <div *ngIf="!roleManagementLoading && userRoles.length === 0" class="empty-state">
            No role assignments found for this user.
          </div>

          <div class="role-list" *ngIf="!roleManagementLoading && userRoles.length > 0">
            <div class="role-item" *ngFor="let assignment of userRoles">
              <div>
                <strong>{{ assignment.role?.name || assignment.roleId }}</strong>
                <p>
                  {{ assignment.role?.description || 'No description provided.' }}
                </p>
                <span class="scope-chip">
                  {{ assignment.appScope?.name || assignment.appScopeId }}
                </span>
              </div>
              <otui-button
                variant="danger"
                (action)="unassignRole(assignment)"
                [disabled]="roleMutationLoading"
              >
                Remove
              </otui-button>
            </div>
          </div>
        </div>

        <div class="role-panel">
          <h3>Available Roles</h3>
          <p class="panel-copy">
            Assign a role from the current catalog to this profile.
          </p>

          <div *ngIf="roleManagementLoading" class="empty-state">Loading available roles...</div>
          <div *ngIf="!roleManagementLoading && availableRoles.length === 0" class="empty-state">
            No additional roles are available to assign.
          </div>

          <div class="role-list" *ngIf="!roleManagementLoading && availableRoles.length > 0">
            <div class="role-item" *ngFor="let role of availableRoles">
              <div>
                <strong>{{ role.name }}</strong>
                <p>{{ role.description || 'No description provided.' }}</p>
                <span class="scope-chip">
                  {{ resolveRoleScopeLabel(role) }}
                </span>
              </div>
              <otui-button
                variant="primary"
                (action)="assignRole(role)"
                [disabled]="roleMutationLoading"
              >
                Assign
              </otui-button>
            </div>
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

      .role-modal {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        padding: 12px;
      }

      .role-panel {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 12px;
        padding: 16px;
        background: var(--background, #fff);
      }

      .panel-copy {
        margin: 8px 0 16px;
        color: var(--foreground-secondary, #666);
      }

      .role-list {
        display: grid;
        gap: 12px;
      }

      .role-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 10px;
        padding: 12px;
      }

      .role-item p {
        margin: 4px 0 8px;
        color: var(--foreground-secondary, #666);
      }

      .scope-chip {
        display: inline-flex;
        padding: 4px 8px;
        border-radius: 999px;
        background: var(--accent-shade-lighten-95, #e6f4f1);
        color: var(--accent, #0a6c74);
        font-size: 0.8rem;
        font-weight: 600;
      }

      .empty-state {
        color: var(--foreground-secondary, #666);
      }
    `,
  ],
})
export class UsersManagementComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly messageService = inject(MessageService);

  users: ProfileDto[] = [];
  loading = false;
  showRoleModal = false;
  selectedUser: ProfileDto | null = null;
  roles: RoleDto[] = [];
  userRoles: UserRoleDto[] = [];
  availableRoles: RoleDto[] = [];
  roleManagementLoading = false;
  roleMutationLoading = false;

  ngOnInit(): void {
    this.loadUsers();
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

  onManageRoles(user: ProfileDto): void {
    this.selectedUser = user;
    this.showRoleModal = true;
    this.loadRoleManagementData(user.id);
  }

  closeRoleModal(): void {
    this.showRoleModal = false;
    this.selectedUser = null;
    this.roles = [];
    this.userRoles = [];
    this.availableRoles = [];
    this.roleManagementLoading = false;
    this.roleMutationLoading = false;
  }

  assignRole(role: RoleDto): void {
    if (!this.selectedUser) return;

    const appScopeId = this.resolveRoleScopeId(role);
    if (!appScopeId) {
      this.messageService.addMessage({
        content: `Cannot assign ${role.name} because it has no app scope.`,
        type: 'error',
      });
      return;
    }

    this.roleMutationLoading = true;

    this.rolesService
      .assignRole({
        roleId: role.id,
        profileId: this.selectedUser.id,
        appScopeId,
      })
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: `Assigned ${role.name} to ${this.getSelectedUserName()}.`,
            type: 'success',
          });
          this.loadRoleManagementData(this.selectedUser!.id);
        },
        error: (err) => {
          this.roleMutationLoading = false;
          this.messageService.addMessage({
            content: err.error?.message || `Failed to assign ${role.name}.`,
            type: 'error',
          });
        },
      });
  }

  unassignRole(assignment: UserRoleDto): void {
    this.roleMutationLoading = true;

    this.rolesService.unassignRole(assignment.id).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: `Removed ${assignment.role?.name || 'role'} from ${this.getSelectedUserName()}.`,
          type: 'success',
        });
        if (this.selectedUser) {
          this.loadRoleManagementData(this.selectedUser.id);
        } else {
          this.roleMutationLoading = false;
        }
      },
      error: (err) => {
        this.roleMutationLoading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to remove role assignment.',
          type: 'error',
        });
      },
    });
  }

  get roleModalHeading(): string {
    return this.selectedUser
      ? `Manage Roles: ${this.getSelectedUserName()}`
      : 'Manage Roles';
  }

  resolveRoleScopeLabel(role: RoleDto): string {
    return role.appScope?.name || 'Scope unavailable';
  }

  private loadRoleManagementData(profileId: string): void {
    this.roleManagementLoading = true;
    this.roleMutationLoading = false;
    this.messageService.clearMessages();

    forkJoin({
      roles: this.rolesService.getRoles(),
      userRoles: this.rolesService.getUserRoles(profileId),
    }).subscribe({
      next: ({ roles, userRoles }) => {
        const assignedRoleIds = new Set(userRoles.map((assignment) => assignment.roleId));

        this.roles = roles;
        this.userRoles = userRoles;
        this.availableRoles = roles.filter((role) => !assignedRoleIds.has(role.id));
        this.roleManagementLoading = false;
      },
      error: (err) => {
        this.roleManagementLoading = false;
        this.roleMutationLoading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to load role management data.',
          type: 'error',
        });
      },
    });
  }

  private resolveRoleScopeId(role: RoleDto): string | null {
    const appScope = role.appScope as { id?: string } | undefined;
    return appScope?.id || null;
  }

  private getSelectedUserName(): string {
    return (
      this.selectedUser?.profileName ||
      this.selectedUser?.id ||
      'selected user'
    );
  }
}

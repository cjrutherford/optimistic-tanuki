import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ButtonComponent } from '@optimistic-tanuki/common-ui/button/button.component';
import { CardComponent } from '@optimistic-tanuki/common-ui/card/card.component';
import { HeadingComponent } from '@optimistic-tanuki/common-ui/heading/heading.component';
import { ModalComponent } from '@optimistic-tanuki/common-ui/modal/modal.component';
import { MessageComponent } from '@optimistic-tanuki/message-ui/message/message.component';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import {
  ProfileDto,
  ProfileTelosDto,
  RoleDto,
  UserRoleDto,
} from '@optimistic-tanuki/ui-models';
import { UsersService } from '../services/users.service';
import { RolesService } from '../services/roles.service';
import { AgUsersTableComponent } from './ag-users-table.component';
import { CharacterSheetComponent } from '@optimistic-tanuki/profile-ui';

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
    CharacterSheetComponent,
  ],
  template: `
    <lib-message></lib-message>

    <otui-card>
      <div class="header-row">
        <otui-heading level="2">Users Management</otui-heading>
        <otui-button
          variant="primary"
          (action)="rebuildSeededTelos()"
          [disabled]="seededBulkRebuildLoading || seededUserIds.length === 0"
        >
          Rebuild Seeded TELOS
        </otui-button>
      </div>

      <div class="seeded-summary-strip" *ngIf="seededCharacterSummaries.length">
        <div
          class="summary-card"
          *ngFor="let summary of seededCharacterSummaries"
        >
          <strong>{{ summary.profileName }}</strong>
          <span>{{ summary.classLabel }} · {{ summary.levelLabel }}</span>
          <span>{{ summary.statusLabel }}</span>
        </div>
      </div>

      <app-ag-users-table
        [users]="users"
        [seededProfileIds]="seededUserIds"
        [telosSummaries]="telosSummaries"
        [loading]="loading"
        (manageRoles)="onManageRoles($event)"
        (manageTelos)="onManageTelos($event)"
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

          <div *ngIf="roleManagementLoading" class="empty-state">
            Loading role assignments...
          </div>
          <div
            *ngIf="!roleManagementLoading && userRoles.length === 0"
            class="empty-state"
          >
            No role assignments found for this user.
          </div>

          <div
            class="role-list"
            *ngIf="!roleManagementLoading && userRoles.length > 0"
          >
            <div class="role-item" *ngFor="let assignment of userRoles">
              <div>
                <strong>{{
                  assignment.role?.name || assignment.roleId
                }}</strong>
                <p>
                  {{
                    assignment.role?.description || 'No description provided.'
                  }}
                </p>
                <span class="scope-chip">
                  {{ assignment.appScope.name || assignment.appScopeId }}
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

          <div *ngIf="roleManagementLoading" class="empty-state">
            Loading available roles...
          </div>
          <div
            *ngIf="!roleManagementLoading && availableRoles.length === 0"
            class="empty-state"
          >
            No additional roles are available to assign.
          </div>

          <div
            class="role-list"
            *ngIf="!roleManagementLoading && availableRoles.length > 0"
          >
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

    <otui-modal
      *ngIf="showTelosModal"
      [heading]="telosModalHeading"
      (closeModal)="closeTelosModal()"
      mode="standard-modal"
      size="lg"
    >
      <div class="telos-modal">
        <div class="telos-toolbar">
          <otui-button
            variant="primary"
            (action)="regenerateTelos()"
            [disabled]="telosMutationLoading || !selectedUser"
          >
            Rebuild
          </otui-button>
          <otui-button
            variant="danger"
            (action)="resetTelos()"
            [disabled]="telosMutationLoading || !selectedUser"
          >
            Reset Summary
          </otui-button>
        </div>

        <div *ngIf="telosLoading" class="empty-state">
          Loading TELOS data...
        </div>

        <div *ngIf="!telosLoading && !selectedUserTelos" class="empty-state">
          No TELOS document is currently available for this profile.
        </div>

        <ng-container *ngIf="!telosLoading && selectedUserTelos">
          <lib-character-sheet
            [enabled]="true"
            [skin]="'grounded'"
            [profileTelos]="selectedUserTelos"
          ></lib-character-sheet>

          <div class="telos-summary-grid">
            <div class="role-panel">
              <h3>Status</h3>
              <p>
                <strong>Generation:</strong>
                {{ selectedUserTelos.generationStatus }}
              </p>
              <p>
                <strong>Source facts:</strong>
                {{ selectedUserTelos.sourceCount }}
              </p>
              <p>
                <strong>Generated:</strong>
                {{ selectedUserTelos.generatedAt || 'Not generated yet' }}
              </p>
              <p>
                <strong>Updated from sources:</strong>
                {{ selectedUserTelos.sourceUpdatedAt || 'Unknown' }}
              </p>
            </div>

            <div class="role-panel">
              <h3>Summary</h3>
              <p>
                {{
                  selectedUserTelos.overallProfileSummary ||
                    'No summary generated yet.'
                }}
              </p>
            </div>
          </div>
        </ng-container>
      </div>
    </otui-modal>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 16px;
      }

      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .seeded-summary-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin: 16px 0 8px;
      }

      .summary-card {
        display: grid;
        gap: 4px;
        padding: 12px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 10px;
        background: var(--background, #fff);
      }

      .summary-card span {
        color: var(--foreground-secondary, #666);
        font-size: 0.9rem;
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

      .telos-modal {
        display: grid;
        gap: 16px;
        padding: 12px;
      }

      .telos-toolbar {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .telos-summary-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }
    `,
  ],
})
export class UsersManagementComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly messageService = inject(MessageService);
  private readonly seededEmailDomain = '@example.com';

  users: ProfileDto[] = [];
  seededUserIds: string[] = [];
  telosSummaries: Record<string, ProfileTelosDto | null> = {};
  loading = false;
  showRoleModal = false;
  selectedUser: ProfileDto | null = null;
  roles: RoleDto[] = [];
  userRoles: UserRoleDto[] = [];
  availableRoles: RoleDto[] = [];
  roleManagementLoading = false;
  roleMutationLoading = false;
  showTelosModal = false;
  selectedUserTelos: ProfileTelosDto | null = null;
  telosLoading = false;
  telosMutationLoading = false;
  seededBulkRebuildLoading = false;

  ngOnInit(): void {
    this.loadUsers();
  }

  get seededCharacterSummaries(): Array<{
    profileId: string;
    profileName: string;
    classLabel: string;
    levelLabel: string;
    statusLabel: string;
  }> {
    return this.seededUserIds
      .map((profileId) => {
        const profile = this.users.find((entry) => entry.id === profileId);
        const telos = this.telosSummaries[profileId];
        if (!profile || !telos) {
          return null;
        }

        return {
          profileId,
          profileName: profile.profileName,
          classLabel: telos.characterSheet.classLabel,
          levelLabel:
            telos.generationStatus === 'ready'
              ? `Level ${telos.characterSheet.level}`
              : 'Awaiting rebuild',
          statusLabel: `Status: ${telos.generationStatus}`,
        };
      })
      .filter(
        (
          summary
        ): summary is {
          profileId: string;
          profileName: string;
          classLabel: string;
          levelLabel: string;
          statusLabel: string;
        } => summary !== null
      );
  }

  loadUsers(): void {
    this.loading = true;
    this.messageService.clearMessages();

    this.usersService.getProfiles().subscribe({
      next: (users) => {
        this.users = users;
        this.seededUserIds = users
          .filter((user) => this.isSeededUser(user))
          .map((user) => user.id);

        if (users.length === 0) {
          this.loading = false;
          this.messageService.addMessage({
            content: 'No users found in the system.',
            type: 'info',
          });
          return;
        }

        this.loadSeededTelosSummaries();
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

  onManageTelos(user: ProfileDto): void {
    this.selectedUser = user;
    this.showTelosModal = true;
    this.loadTelos(user.id);
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

  closeTelosModal(): void {
    this.showTelosModal = false;
    this.selectedUser = null;
    this.selectedUserTelos = null;
    this.telosLoading = false;
    this.telosMutationLoading = false;
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
          content: `Removed ${
            assignment.role?.name || 'role'
          } from ${this.getSelectedUserName()}.`,
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

  get telosModalHeading(): string {
    return this.selectedUser ? `TELOS: ${this.getSelectedUserName()}` : 'TELOS';
  }

  resolveRoleScopeLabel(role: RoleDto): string {
    return role.appScope.name || 'Scope unavailable';
  }

  regenerateTelos(): void {
    if (!this.selectedUser) return;

    this.telosMutationLoading = true;
    this.usersService.regenerateProfileTelos(this.selectedUser.id).subscribe({
      next: (telos) => {
        this.selectedUserTelos = telos;
        this.updateTelosSummary(this.selectedUser?.id, telos);
        this.telosMutationLoading = false;
        this.messageService.addMessage({
          content: `Triggered TELOS rebuild for ${this.getSelectedUserName()}.`,
          type: 'success',
        });
      },
      error: (err) => {
        this.telosMutationLoading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to rebuild TELOS.',
          type: 'error',
        });
      },
    });
  }

  resetTelos(): void {
    if (!this.selectedUser) return;

    this.telosMutationLoading = true;
    this.usersService.resetProfileTelos(this.selectedUser.id).subscribe({
      next: (telos) => {
        this.selectedUserTelos = telos;
        this.updateTelosSummary(this.selectedUser?.id, telos);
        this.telosMutationLoading = false;
        this.messageService.addMessage({
          content: `Reset derived TELOS summary for ${this.getSelectedUserName()}.`,
          type: 'success',
        });
      },
      error: (err) => {
        this.telosMutationLoading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to reset TELOS summary.',
          type: 'error',
        });
      },
    });
  }

  rebuildSeededTelos(): void {
    if (this.seededUserIds.length === 0) {
      return;
    }

    this.seededBulkRebuildLoading = true;
    this.usersService.regenerateProfileTelosBulk(this.seededUserIds).subscribe({
      next: (documents) => {
        this.seededBulkRebuildLoading = false;
        documents.forEach((telos, index) => {
          this.updateTelosSummary(this.seededUserIds[index], telos);
        });
        this.messageService.addMessage({
          content: `Rebuilt TELOS for ${this.seededUserIds.length} seeded users.`,
          type: 'success',
        });
      },
      error: (err) => {
        this.seededBulkRebuildLoading = false;
        this.messageService.addMessage({
          content:
            err.error?.message || 'Failed to rebuild seeded TELOS cohort.',
          type: 'error',
        });
      },
    });
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
        const assignedRoleIds = new Set(
          userRoles.map((assignment) => assignment.roleId)
        );

        this.roles = roles;
        this.userRoles = userRoles;
        this.availableRoles = roles.filter(
          (role) => !assignedRoleIds.has(role.id)
        );
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

  private loadTelos(profileId: string): void {
    this.telosLoading = true;
    this.telosMutationLoading = false;
    this.selectedUserTelos = this.telosSummaries[profileId] || null;

    this.usersService.getProfileTelos(profileId).subscribe({
      next: (telos) => {
        this.selectedUserTelos = telos;
        this.updateTelosSummary(profileId, telos);
        this.telosLoading = false;
      },
      error: (err) => {
        this.telosLoading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to load TELOS data.',
          type: 'error',
        });
      },
    });
  }

  private getSelectedUserName(): string {
    return (
      this.selectedUser?.profileName || this.selectedUser?.id || 'selected user'
    );
  }

  private isSeededUser(user: ProfileDto): boolean {
    return !!user.email?.toLowerCase().endsWith(this.seededEmailDomain);
  }

  private loadSeededTelosSummaries(): void {
    if (this.seededUserIds.length === 0) {
      this.telosSummaries = {};
      this.loading = false;
      return;
    }

    forkJoin(
      this.seededUserIds.map((profileId) =>
        this.usersService.getProfileTelos(profileId)
      )
    ).subscribe({
      next: (documents) => {
        this.telosSummaries = documents.reduce<
          Record<string, ProfileTelosDto | null>
        >((acc, telos, index) => {
          acc[this.seededUserIds[index]] = telos;
          return acc;
        }, {});
        this.loading = false;
      },
      error: () => {
        this.telosSummaries = {};
        this.loading = false;
      },
    });
  }

  private updateTelosSummary(
    profileId: string | undefined,
    telos: ProfileTelosDto | null
  ): void {
    if (!profileId || !this.seededUserIds.includes(profileId)) {
      return;
    }

    this.telosSummaries = {
      ...this.telosSummaries,
      [profileId]: telos,
    };
  }
}

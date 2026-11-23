import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonComponent } from '@optimistic-tanuki/common-ui/button/button.component';
import { ModalComponent } from '@optimistic-tanuki/common-ui/modal/modal.component';
import { MessageComponent } from '@optimistic-tanuki/message-ui/message/message.component';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import {
  OwnerConfirmService,
  OwnerDataTableComponent,
  OwnerFilterBarComponent,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import {
  BulkRoleMutationDto,
  BulkRoleMutationPreviewDto,
  BulkRoleMutationResultDto,
  ProfileDto,
  RoleDto,
  UserRoleDto,
} from '@optimistic-tanuki/ui-models';
import { UsersService } from '../services/users.service';
import { RolesService } from '../services/roles.service';
import {
  buildAuditSummary,
  buildUsersColumns,
  describePermissionStatus,
} from './users-management.helpers';
import {
  GovernanceAuditEntry,
  GovernanceAuditService,
} from '../services/governance-audit.service';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    MessageComponent,
    ModalComponent,
    OwnerDataTableComponent,
    OwnerFilterBarComponent,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './users-management.component.html',
  styleUrl: './users-management.component.scss',
})
export class UsersManagementComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly governanceAuditService = inject(GovernanceAuditService);
  private readonly confirmService = inject(OwnerConfirmService);

  users: ProfileDto[] = [];
  /** Null until the first load settles, so the table shows loading. */
  visibleUsers: ProfileDto[] | null = null;
  searchText = '';
  loadError: string | null = null;
  roleLoadError: string | null = null;
  rolesCatalog: RoleDto[] = [];
  showRoleModal = false;
  selectedUser: ProfileDto | null = null;
  selectedUsers: ProfileDto[] = [];
  roles: RoleDto[] = [];
  userRoles: UserRoleDto[] = [];
  availableRoles: RoleDto[] = [];
  roleManagementLoading = false;
  roleMutationLoading = false;
  bulkRoleId = '';
  bulkOperation: 'assign' | 'unassign' = 'assign';
  bulkPreview: BulkRoleMutationPreviewDto | null = null;
  bulkPreviewLoading = false;
  bulkMutationLoading = false;
  bulkTargetId = '';
  selectionResetKey = 0;
  lastBulkMutationPayload: BulkRoleMutationDto | null = null;
  lastBulkMutationResult: BulkRoleMutationResultDto | null = null;
  rollbackLoading = false;
  governanceAuditEntries: GovernanceAuditEntry[] = [];

  readonly columns = buildUsersColumns((user) => this.onManageRoles(user));

  ngOnInit(): void {
    this.loadUsers();
    this.loadRolesCatalog();
    this.governanceAuditEntries = this.governanceAuditService.getEntries();
  }

  loadUsers(): void {
    this.loadError = null;
    this.visibleUsers = null;
    this.messageService.clearMessages();

    this.usersService.getProfiles().subscribe({
      next: (users) => {
        this.users = users;
        this.applyFilter();

        if (users.length === 0) {
          this.messageService.addMessage({
            content: 'No users found in the system.',
            type: 'info',
          });
        }
      },
      error: (err) => {
        this.loadError =
          err.error?.message ||
          err.message ||
          'Failed to load users. Please try again.';
      },
    });
  }

  onSearch(text: string): void {
    this.searchText = text.trim().toLowerCase();
    this.applyFilter();
  }

  private applyFilter(): void {
    const q = this.searchText;
    this.visibleUsers = q
      ? this.users.filter((u) =>
          [u.profileName, u.userId, u.bio].some((v) =>
            (v ?? '').toLowerCase().includes(q)
          )
        )
      : [...this.users];
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

  onSelectedUsersChange(users: ProfileDto[]): void {
    this.selectedUsers = users;
    this.resetBulkPreview();
  }

  onBulkRoleChange(roleId: string): void {
    this.bulkRoleId = roleId;
    this.resetBulkPreview();
  }

  onBulkOperationChange(operation: 'assign' | 'unassign'): void {
    this.bulkOperation = operation;
    this.resetBulkPreview();
  }

  onBulkTargetChange(targetId: string): void {
    this.bulkTargetId = targetId;
    this.resetBulkPreview();
  }

  async assignRole(role: RoleDto): Promise<void> {
    if (!this.selectedUser) return;

    const appScopeId = this.resolveRoleScopeId(role);
    if (!appScopeId) {
      this.messageService.addMessage({
        content: `Cannot assign ${role.name} because it has no app scope.`,
        type: 'error',
      });
      return;
    }

    // The role API takes no reason, so it is collected for the owner's own
    // confirmation only and is not sent.
    const { confirmed } = await this.confirmService.confirm({
      level: 'reason',
      title: `Assign ${role.name}`,
      body: `${this.getSelectedUserName()} will gain every permission in this role.`,
      confirmLabel: 'Assign role',
    });
    if (!confirmed) return;

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

  async unassignRole(assignment: UserRoleDto): Promise<void> {
    const { confirmed } = await this.confirmService.confirm({
      level: 'reason',
      title: `Remove ${assignment.role?.name || 'role'}`,
      body: `${this.getSelectedUserName()} will lose the access this role grants. The role API takes no reason, so it is not recorded.`,
      confirmLabel: 'Remove role',
      destructive: true,
    });
    if (!confirmed) return;

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

  resolveRoleScopeLabel(role: RoleDto): string {
    return role.appScope?.name || 'Scope unavailable';
  }

  get canPreviewBulkMutation(): boolean {
    return (
      this.selectedUsers.length > 0 &&
      !!this.bulkRoleId &&
      !this.bulkPreviewLoading &&
      !this.bulkMutationLoading
    );
  }

  get canExecuteBulkMutation(): boolean {
    return (
      !!this.bulkPreview &&
      this.bulkPreview.affectedCount > 0 &&
      !this.bulkPreviewLoading &&
      !this.bulkMutationLoading
    );
  }

  get bulkExecuteLabel(): string {
    return this.bulkOperation === 'assign'
      ? 'Apply Assignment'
      : 'Apply Removal';
  }

  get canRollbackLastBulkMutation(): boolean {
    return !!this.lastBulkMutationPayload && !this.rollbackLoading;
  }

  get rollbackActionLabel(): string {
    const operation = this.lastBulkMutationResult?.operation;
    return operation === 'assign'
      ? 'Rollback Assignment'
      : 'Restore Assignment';
  }

  previewBulkRoleMutation(): void {
    const payload = this.buildBulkRoleMutationPayload();
    if (!payload) {
      return;
    }

    this.bulkPreviewLoading = true;
    this.bulkPreview = null;
    this.messageService.clearMessages();

    this.rolesService.previewBulkRoleMutation(payload).subscribe({
      next: (preview) => {
        this.bulkPreview = preview;
        this.bulkPreviewLoading = false;
      },
      error: (err) => {
        this.bulkPreviewLoading = false;
        this.messageService.addMessage({
          content:
            err.error?.message ||
            'Failed to preview the selected governance mutation.',
          type: 'error',
        });
      },
    });
  }

  async executeBulkRoleMutation(): Promise<void> {
    const payload = this.buildBulkRoleMutationPayload();
    if (!payload || !this.bulkPreview) {
      return;
    }

    const { confirmed } = await this.confirmService.confirm({
      level: 'typed',
      title: `${this.bulkExecuteLabel} for ${payload.profileIds.length} profiles`,
      body: `${this.bulkPreview.affectedCount} profile(s) will change. Type the role name to apply.`,
      confirmLabel: this.bulkExecuteLabel,
      typedPhrase: this.bulkPreview.roleName,
      destructive: payload.operation === 'unassign',
    });
    if (!confirmed) return;

    this.bulkMutationLoading = true;
    this.messageService.clearMessages();

    this.rolesService.executeBulkRoleMutation(payload).subscribe({
      next: (result) => {
        this.bulkMutationLoading = false;
        this.lastBulkMutationPayload = payload;
        this.lastBulkMutationResult = result;
        this.recordGovernanceAudit({
          kind: 'bulk-role-mutation',
          operation: payload.operation,
          roleId: result.roleId,
          roleName: result.roleName,
          profileIds: payload.profileIds,
          appScopeId: result.appScopeId,
          targetId: result.targetId,
          summary: this.buildAuditSummary(result),
        });
        this.messageService.addMessage({
          content: `${
            this.bulkOperation === 'assign' ? 'Assigned' : 'Removed'
          } ${result.roleName} for ${result.completedCount} profile${
            result.completedCount === 1 ? '' : 's'
          }.`,
          type: 'success',
        });
        this.selectedUsers = [];
        this.bulkPreview = null;
        this.selectionResetKey += 1;
        if (
          this.selectedUser &&
          payload.profileIds.includes(this.selectedUser.id)
        ) {
          this.loadRoleManagementData(this.selectedUser.id);
        }
      },
      error: (err) => {
        this.bulkMutationLoading = false;
        this.messageService.addMessage({
          content:
            err.error?.message ||
            'Failed to execute the selected governance mutation.',
          type: 'error',
        });
      },
    });
  }

  async rollbackLastBulkMutation(): Promise<void> {
    if (!this.lastBulkMutationPayload || !this.lastBulkMutationResult) {
      return;
    }

    const { confirmed } = await this.confirmService.confirm({
      level: 'typed',
      title: this.rollbackActionLabel,
      body: `This applies the opposite change to ${this.lastBulkMutationPayload.profileIds.length} profile(s). Type the role name to continue.`,
      confirmLabel: this.rollbackActionLabel,
      typedPhrase: this.lastBulkMutationResult.roleName,
      destructive: true,
    });
    if (!confirmed) return;

    const rollbackPayload: BulkRoleMutationDto = {
      ...this.lastBulkMutationPayload,
      operation:
        this.lastBulkMutationPayload.operation === 'assign'
          ? 'unassign'
          : 'assign',
    };

    this.rollbackLoading = true;

    this.rolesService.executeBulkRoleMutation(rollbackPayload).subscribe({
      next: (result) => {
        this.rollbackLoading = false;
        this.lastBulkMutationPayload = rollbackPayload;
        this.lastBulkMutationResult = result;
        this.recordGovernanceAudit({
          kind: 'bulk-role-mutation',
          operation: rollbackPayload.operation,
          roleId: result.roleId,
          roleName: result.roleName,
          profileIds: rollbackPayload.profileIds,
          appScopeId: result.appScopeId,
          targetId: result.targetId,
          summary: `Rollback applied. ${this.buildAuditSummary(result)}`,
        });
        this.messageService.addMessage({
          content: `Rollback applied for ${result.roleName} across ${
            result.completedCount
          } profile${result.completedCount === 1 ? '' : 's'}.`,
          type: 'success',
        });
      },
      error: (err) => {
        this.rollbackLoading = false;
        this.messageService.addMessage({
          content:
            err.error?.message ||
            'Failed to rollback the last governance mutation.',
          type: 'error',
        });
      },
    });
  }

  describeProfiles(profileIds: string[]): string {
    return profileIds
      .map((profileId) => this.getProfileLabel(profileId))
      .join(', ');
  }

  describePermissionStatus = describePermissionStatus;

  getProfileDisplayName(profileId: string): string {
    return this.getProfileLabel(profileId);
  }

  traceSelectedProfileAccess(): void {
    if (this.selectedUsers.length !== 1) {
      return;
    }

    this.router.navigate(['/dashboard/permissions-inspector'], {
      queryParams: {
        profileId: this.selectedUsers[0].id,
        source: 'users',
      },
    });
  }

  buildAuditSummary = buildAuditSummary;

  retryRoleManagement(): void {
    if (this.selectedUser) this.loadRoleManagementData(this.selectedUser.id);
  }

  private loadRoleManagementData(profileId: string): void {
    this.roleManagementLoading = true;
    this.roleMutationLoading = false;
    this.roleLoadError = null;
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
        this.roleLoadError =
          err.error?.message || 'Failed to load role management data.';
      },
    });
  }

  private resolveRoleScopeId(role: RoleDto): string | null {
    const appScope = role.appScope as { id?: string } | undefined;
    return appScope?.id || null;
  }

  private loadRolesCatalog(): void {
    this.rolesService.getRoles().subscribe({
      next: (roles) => {
        this.rolesCatalog = roles;
      },
      error: (err) => {
        this.rolesCatalog = [];
        this.messageService.addMessage({
          content:
            err?.error?.message ||
            'Failed to load the role list. Bulk role changes are unavailable.',
          type: 'error',
        });
      },
    });
  }

  private buildBulkRoleMutationPayload(): BulkRoleMutationDto | null {
    const selectedRole = this.rolesCatalog.find(
      (role) => role.id === this.bulkRoleId
    );
    const appScopeId = selectedRole
      ? this.resolveRoleScopeId(selectedRole)
      : null;

    if (!selectedRole || !appScopeId || this.selectedUsers.length === 0) {
      return null;
    }

    return {
      operation: this.bulkOperation,
      roleId: selectedRole.id,
      profileIds: this.selectedUsers.map((user) => user.id),
      appScopeId,
      targetId: this.bulkTargetId.trim() || undefined,
    } as const;
  }

  private getProfileLabel(profileId: string): string {
    const profile = this.users.find((user) => user.id === profileId);
    return profile?.profileName || profile?.userId || profileId;
  }

  private resetBulkPreview(): void {
    this.bulkPreview = null;
  }

  private recordGovernanceAudit(
    entry: Omit<GovernanceAuditEntry, 'id' | 'occurredAt'>
  ): void {
    this.governanceAuditService.recordEntry(entry);
    this.governanceAuditEntries = this.governanceAuditService.getEntries();
  }

  private getSelectedUserName(): string {
    return (
      this.selectedUser?.profileName || this.selectedUser?.id || 'selected user'
    );
  }
}

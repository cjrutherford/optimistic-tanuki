import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonComponent } from '@optimistic-tanuki/common-ui/button/button.component';
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
import {
  OwnerConfirmService,
  OwnerDataTableComponent,
  OwnerFilterBarComponent,
  OwnerPageHeaderComponent,
} from '@optimistic-tanuki/owner-page-ui';
import type { ColDef } from '@optimistic-tanuki/ag-grid-ui';
import { UsersService } from '../services/users.service';
import { GovernanceAuditService } from '../services/governance-audit.service';

interface RoleImpactSummary {
  assignedProfileCount: number;
  appScopeLabel: string;
  sampleProfiles: string[];
}

@Component({
  selector: 'app-roles-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MessageComponent,
    ModalComponent,
    ButtonComponent,
    TextInputComponent,
    TextAreaComponent,
    OwnerPageHeaderComponent,
    OwnerFilterBarComponent,
    OwnerDataTableComponent,
  ],
  templateUrl: './roles-management.component.html',
  styleUrls: ['./roles-management.component.scss'],
})
export class RolesManagementComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly appScopesService = inject(AppScopesService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly messageService = inject(MessageService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly governanceAuditService = inject(GovernanceAuditService);
  private readonly confirmService = inject(OwnerConfirmService);

  roles: RoleDto[] = [];
  loadError: string | null = null;
  searchText = '';

  readonly columns: ColDef[] = [
    { field: 'name', headerName: 'Name', flex: 2 },
    { field: 'description', headerName: 'Description', flex: 3 },
    {
      field: 'appScope.name',
      headerName: 'App scope',
      flex: 2,
      valueFormatter: (params) => params.value || 'N/A',
    },
    {
      headerName: 'Actions',
      width: 200,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data: RoleDto }) => {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '0.5rem';
        const edit = document.createElement('button');
        edit.textContent = 'Edit';
        edit.className = 'ag-grid-action-button';
        edit.addEventListener('click', () => this.openEditModal(params.data));
        const del = document.createElement('button');
        del.textContent = 'Delete';
        del.className = 'ag-grid-action-button ag-grid-delete-button';
        del.addEventListener('click', () => {
          void this.openDeleteConfirm(params.data);
        });
        container.append(edit, del);
        return container;
      },
    },
  ];

  private visibleCache: { roles: RoleDto[]; q: string; out: RoleDto[] } | null =
    null;

  /** Null while loading or after a failed load, so the table shows state, not an empty list. */
  get visibleRoles(): RoleDto[] | null {
    if (this.loading || this.loadError) return null;
    const q = this.searchText.trim().toLowerCase();
    if (
      this.visibleCache &&
      this.visibleCache.roles === this.roles &&
      this.visibleCache.q === q
    ) {
      return this.visibleCache.out;
    }
    const out = q
      ? this.roles.filter((r) =>
          [r.name, r.description, r.appScope?.name]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        )
      : this.roles;
    this.visibleCache = { roles: this.roles, q, out };
    return out;
  }

  onSearch(text: string): void {
    this.searchText = text ?? '';
  }
  appScopes: AppScopeDto[] = [];
  permissions: PermissionDto[] = [];
  loading = false;

  showFormModal = false;
  isEditMode = false;
  currentRole: RoleDto | null = null;

  formData: CreateRoleDto & { id?: string } = {
    name: '',
    description: '',
    appScopeId: '',
  };

  roleImpactSummary: RoleImpactSummary = {
    assignedProfileCount: 0,
    appScopeLabel: 'Scope unavailable',
    sampleProfiles: [],
  };

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
    this.loadError = null;
    this.messageService.clearMessages();

    this.rolesService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        const errorMessage =
          err.error?.message ||
          err.message ||
          'Failed to load roles. Please try again.';
        this.loadError = errorMessage;
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
    this.roleImpactSummary = {
      assignedProfileCount: 0,
      appScopeLabel: 'Scope unavailable',
      sampleProfiles: [],
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
    this.loadRoleImpactSummary(role);
  }

  closeFormModal(): void {
    this.showFormModal = false;
  }

  async addPermission(permissionId: string): Promise<void> {
    if (!this.currentRole?.id || !this.isEditMode) {
      return;
    }
    const permission = this.permissions.find((p) => p.id === permissionId);
    // Reason is collected in the UI only: the roles API accepts none.
    const result = await this.confirmService.confirm({
      level: 'reason',
      title: 'Add permission to role',
      body: `Add ${permission?.name ?? 'this permission'} to ${
        this.currentRole.name
      }? Everyone who holds this role gains it.`,
      confirmLabel: 'Add permission',
    });
    if (!result.confirmed || !this.currentRole?.id) return;

    this.rolesService
      .addPermissionToRole(this.currentRole.id, permissionId)
      .subscribe({
        next: () => {
          this.governanceAuditService.recordEntry({
            kind: 'role-permission-added',
            roleId: this.currentRole!.id,
            roleName: this.currentRole!.name,
            permissionId,
            summary: `Permission added to ${this.currentRole!.name}.`,
          });
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

  async removePermission(permissionId: string): Promise<void> {
    if (!this.currentRole?.id || !this.isEditMode) {
      return;
    }
    const permission = this.currentRole.permissions?.find(
      (p) => p.id === permissionId
    );
    // Reason is collected in the UI only: the roles API accepts none.
    const result = await this.confirmService.confirm({
      level: 'reason',
      title: 'Remove permission from role',
      body: `Remove ${permission?.name ?? 'this permission'} from ${
        this.currentRole.name
      }? Everyone who holds this role loses it.`,
      confirmLabel: 'Remove permission',
      destructive: true,
    });
    if (!result.confirmed || !this.currentRole?.id) return;

    this.rolesService
      .removePermissionFromRole(this.currentRole.id, permissionId)
      .subscribe({
        next: () => {
          this.governanceAuditService.recordEntry({
            kind: 'role-permission-removed',
            roleId: this.currentRole!.id,
            roleName: this.currentRole!.name,
            permissionId,
            summary: `Permission removed from ${this.currentRole!.name}.`,
          });
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

  async submitForm(): Promise<void> {
    if (!this.isFormValid()) {
      this.messageService.addMessage({
        content: 'Please fill in all required fields.',
        type: 'error',
      });
      return;
    }

    // Reason is collected in the UI only: the roles API accepts none.
    const result = this.isEditMode
      ? await this.confirmService.confirm({
          level: 'reason',
          title: 'Save changes to this role',
          body: `Updating ${this.formData.name} may change access for users who hold it.`,
          confirmLabel: 'Save changes',
        })
      : await this.confirmService.confirm({
          level: 'plain',
          title: 'Create this role',
          body: `Create the role ${this.formData.name}?`,
          confirmLabel: 'Create role',
        });
    if (!result.confirmed) return;
    if (this.isEditMode) this.updateRole();
    else this.createRole();
  }

  async openDeleteConfirm(role: RoleDto): Promise<void> {
    // Reason is collected in the UI only: the roles API accepts none.
    const result = await this.confirmService.confirm({
      level: 'typed',
      title: 'Delete this role',
      body: `Deleting ${role.name} cannot be undone. Everyone who holds it loses its permissions.`,
      confirmLabel: 'Delete role',
      typedPhrase: role.name,
      destructive: true,
    });
    if (!result.confirmed) return;
    this.currentRole = role;
    this.deleteRole();
  }

  traceRoleAssignments(): void {
    if (!this.currentRole?.id) {
      return;
    }

    this.router.navigate(['/dashboard/permissions-inspector'], {
      queryParams: {
        roleId: this.currentRole.id,
        roleName: this.currentRole.name,
        source: 'roles',
      },
    });
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
        this.governanceAuditService.recordEntry({
          kind: 'role-updated',
          roleId: this.formData.id!,
          roleName: this.formData.name,
          appScopeId: this.formData.appScopeId,
          summary: `Role ${this.formData.name} updated.`,
        });
        this.messageService.addMessage({
          content: 'Role updated successfully!',
          type: 'success',
        });
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
        this.governanceAuditService.recordEntry({
          kind: 'role-deleted',
          roleId: this.currentRole!.id,
          roleName: this.currentRole!.name,
          summary: `Role ${this.currentRole!.name} deleted.`,
        });
        this.messageService.addMessage({
          content: 'Role deleted successfully!',
          type: 'success',
        });
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

  private loadRoleImpactSummary(role: RoleDto): void {
    this.roleImpactSummary = {
      assignedProfileCount: 0,
      appScopeLabel: role.appScope?.name || 'Scope unavailable',
      sampleProfiles: [],
    };

    this.usersService.getProfiles().subscribe({
      next: (profiles) => {
        if (!profiles.length) {
          return;
        }

        forkJoin(
          profiles.map((profile) => this.rolesService.getUserRoles(profile.id))
        ).subscribe({
          next: (assignmentsByProfile) => {
            const matchedProfiles = profiles.filter((profile, index) =>
              (assignmentsByProfile[index] ?? []).some(
                (assignment) => assignment.roleId === role.id
              )
            );

            this.roleImpactSummary = {
              assignedProfileCount: matchedProfiles.length,
              appScopeLabel: role.appScope?.name || 'Scope unavailable',
              sampleProfiles: matchedProfiles
                .slice(0, 3)
                .map((profile) => profile.profileName || profile.userId),
            };
          },
          error: () => {
            this.roleImpactSummary = {
              assignedProfileCount: 0,
              appScopeLabel: role.appScope?.name || 'Scope unavailable',
              sampleProfiles: [],
            };
          },
        });
      },
      error: () => {
        this.roleImpactSummary = {
          assignedProfileCount: 0,
          appScopeLabel: role.appScope?.name || 'Scope unavailable',
          sampleProfiles: [],
        };
      },
    });
  }
}

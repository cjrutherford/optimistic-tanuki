import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridOptions } from 'ag-grid-community';
import { UsersService } from '../services/users.service';
import { RolesService } from '../services/roles.service';
import { PermissionsService } from '../services/permissions.service';
import { ProfileDto, RoleDto, PermissionDto } from '@optimistic-tanuki/ui-models';
import { ThemeService } from '@optimistic-tanuki/theme-ui';
import { Themeable } from '@optimistic-tanuki/common-ui';
import { themeQuartz } from 'ag-grid-community';
import { firstValueFrom } from 'rxjs';

interface RoleAssignmentResponse {
  role?: {
    id: string;
    name: string;
    permissions?: PermissionResponse[];
  };
}

interface PermissionResponse {
  id: string;
  name?: string;
  action?: string;
  description?: string;
}

interface UserPermissionInfo {
  profileId: string;
  profileName: string;
  email: string;
  appScope: string;
  roles: string[];
  permissions: string[];
  allowedRoutes: string[];
}

interface UnusedInfo {
  type: 'permission' | 'role';
  name: string;
  id: string;
  description: string;
  usageCount: number;
}

@Component({
  selector: 'app-permissions-inspector',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  template: `
    <div class="permissions-inspector">
      <h2>Permissions Inspector</h2>
      
      <div class="controls">
        <div class="form-group">
          <label for="profileSelect">Select User Profile:</label>
          <select 
            id="profileSelect" 
            [(ngModel)]="selectedProfileId()" 
            (change)="onProfileChange()"
            class="form-control">
            <option value="">-- Select a user --</option>
            @for (profile of profiles(); track profile.id) {
              <option [value]="profile.id">
                {{ profile.profileName }} ({{ profile.email }}) - {{ profile.appScope }}
              </option>
            }
          </select>
        </div>
        
        <button (click)="inspectAllProfiles()" class="btn btn-primary">
          Inspect All Profiles
        </button>
        
        <button (click)="findUnusedItems()" class="btn btn-secondary">
          Find Unused Permissions & Roles
        </button>
      </div>

      @if (selectedPermissionInfo()) {
        <div class="permission-details">
          <h3>Permission Details for {{ selectedPermissionInfo()?.profileName }}</h3>
          
          <div class="details-grid">
            <div class="detail-section">
              <h4>Profile Information</h4>
              <p><strong>Profile ID:</strong> {{ selectedPermissionInfo()?.profileId }}</p>
              <p><strong>Email:</strong> {{ selectedPermissionInfo()?.email }}</p>
              <p><strong>App Scope:</strong> {{ selectedPermissionInfo()?.appScope }}</p>
            </div>
            
            <div class="detail-section">
              <h4>Assigned Roles ({{ selectedPermissionInfo()?.roles.length }})</h4>
              <ul>
                @for (role of selectedPermissionInfo()?.roles; track role) {
                  <li>{{ role }}</li>
                }
                @empty {
                  <li class="no-data">No roles assigned</li>
                }
              </ul>
            </div>
            
            <div class="detail-section">
              <h4>Effective Permissions ({{ selectedPermissionInfo()?.permissions.length }})</h4>
              <div class="permissions-list">
                @for (permission of selectedPermissionInfo()?.permissions; track permission) {
                  <span class="permission-badge">{{ permission }}</span>
                }
                @empty {
                  <p class="no-data">No permissions granted</p>
                }
              </div>
            </div>
            
            <div class="detail-section">
              <h4>Allowed Routes ({{ selectedPermissionInfo()?.allowedRoutes.length }})</h4>
              <div class="routes-list">
                @for (route of selectedPermissionInfo()?.allowedRoutes; track route) {
                  <code>{{ route }}</code>
                }
                @empty {
                  <p class="no-data">No specific route permissions</p>
                }
              </div>
            </div>
          </div>
        </div>
      }

      @if (allProfilesData().length > 0) {
        <div class="all-profiles-table">
          <h3>All Profiles Overview</h3>
          <ag-grid-angular
            style="height: 400px;"
            class="ag-theme-quartz"
            [rowData]="allProfilesData()"
            [columnDefs]="profilesColumnDefs"
            [gridOptions]="profilesGridOptions"
            [theme]="agGridTheme"
          />
        </div>
      }

      @if (unusedItems().length > 0) {
        <div class="unused-items-table">
          <h3>Unused Permissions & Roles</h3>
          <ag-grid-angular
            style="height: 400px;"
            class="ag-theme-quartz"
            [rowData]="unusedItems()"
            [columnDefs]="unusedColumnDefs"
            [gridOptions]="unusedGridOptions"
            [theme]="agGridTheme"
          />
        </div>
      }

      @if (loading()) {
        <div class="loading-overlay">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>
      }

      @if (error()) {
        <div class="error-message">
          {{ error() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .permissions-inspector {
      padding: 20px;
    }

    .controls {
      margin-bottom: 20px;
      display: flex;
      gap: 15px;
      align-items: flex-end;
    }

    .form-group {
      flex: 1;
      max-width: 400px;
    }

    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }

    .form-control {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }

    .btn-primary {
      background-color: #007bff;
      color: white;
    }

    .btn-primary:hover {
      background-color: #0056b3;
    }

    .btn-secondary {
      background-color: #6c757d;
      color: white;
    }

    .btn-secondary:hover {
      background-color: #545b62;
    }

    .permission-details {
      margin-top: 20px;
      padding: 20px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 15px;
    }

    .detail-section {
      background: white;
      padding: 15px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .detail-section h4 {
      margin-top: 0;
      color: #333;
      border-bottom: 2px solid #007bff;
      padding-bottom: 8px;
    }

    .detail-section ul {
      list-style: none;
      padding: 0;
      margin: 10px 0;
    }

    .detail-section li {
      padding: 5px 0;
      border-bottom: 1px solid #eee;
    }

    .detail-section li:last-child {
      border-bottom: none;
    }

    .no-data {
      color: #999;
      font-style: italic;
    }

    .permissions-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .permission-badge {
      background-color: #007bff;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      white-space: nowrap;
    }

    .routes-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 10px;
    }

    .routes-list code {
      background-color: #f4f4f4;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.9em;
      border-left: 3px solid #28a745;
    }

    .all-profiles-table,
    .unused-items-table {
      margin-top: 30px;
    }

    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-overlay p {
      color: white;
      margin-top: 15px;
      font-size: 18px;
    }

    .error-message {
      background-color: #f8d7da;
      color: #721c24;
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
      border: 1px solid #f5c6cb;
    }
  `]
})
export class PermissionsInspectorComponent extends Themeable implements OnInit {
  profiles = signal<ProfileDto[]>([]);
  selectedProfileId = signal<string>('');
  selectedPermissionInfo = signal<UserPermissionInfo | null>(null);
  allProfilesData = signal<UserPermissionInfo[]>([]);
  unusedItems = signal<UnusedInfo[]>([]);
  loading = signal<boolean>(false);
  error = signal<string>('');

  agGridTheme = themeQuartz;
  
  profilesColumnDefs: ColDef[] = [
    { field: 'profileName', headerName: 'Name', sortable: true, filter: true },
    { field: 'email', headerName: 'Email', sortable: true, filter: true },
    { field: 'appScope', headerName: 'App Scope', sortable: true, filter: true },
    { 
      field: 'roles', 
      headerName: 'Roles', 
      valueFormatter: (params) => params.value?.join(', ') || 'None',
      sortable: true, 
      filter: true 
    },
    { 
      field: 'permissions', 
      headerName: 'Permissions Count', 
      valueGetter: (params) => params.data?.permissions?.length || 0,
      sortable: true 
    },
    { 
      field: 'allowedRoutes', 
      headerName: 'Routes Count', 
      valueGetter: (params) => params.data?.allowedRoutes?.length || 0,
      sortable: true 
    }
  ];

  unusedColumnDefs: ColDef[] = [
    { field: 'type', headerName: 'Type', sortable: true, filter: true },
    { field: 'name', headerName: 'Name', sortable: true, filter: true },
    { field: 'description', headerName: 'Description', sortable: true, filter: true, flex: 1 },
    { field: 'usageCount', headerName: 'Usage Count', sortable: true }
  ];

  profilesGridOptions: GridOptions = {
    defaultColDef: {
      resizable: true,
      sortable: true,
      filter: true
    },
    pagination: true,
    paginationPageSize: 20
  };

  unusedGridOptions: GridOptions = {
    defaultColDef: {
      resizable: true,
      sortable: true,
      filter: true
    },
    pagination: true,
    paginationPageSize: 20
  };

  constructor(
    private usersService: UsersService,
    private rolesService: RolesService,
    private permissionsService: PermissionsService,
    themeService: ThemeService
  ) {
    super(themeService);
  }

  ngOnInit(): void {
    this.loadProfiles();
  }

  loadProfiles(): void {
    this.loading.set(true);
    this.error.set('');
    
    this.usersService.getProfiles().subscribe({
      next: (profiles) => {
        this.profiles.set(profiles);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load profiles: ' + err.message);
        this.loading.set(false);
      }
    });
  }

  onProfileChange(): void {
    const profileId = this.selectedProfileId();
    if (!profileId) {
      this.selectedPermissionInfo.set(null);
      return;
    }

    this.inspectProfile(profileId);
  }

  async inspectProfile(profileId: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const profile = this.profiles().find(p => p.id === profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      const roles = await firstValueFrom(this.rolesService.getUserRoles(profileId));
      
      // Extract all permissions from all roles
      const permissions = new Set<string>();
      const roleNames: string[] = [];
      
      if (roles && Array.isArray(roles)) {
        (roles as RoleAssignmentResponse[]).forEach((roleAssignment) => {
          if (roleAssignment.role) {
            roleNames.push(roleAssignment.role.name);
            if (roleAssignment.role.permissions) {
              roleAssignment.role.permissions.forEach((perm) => {
                permissions.add(this.getPermissionName(perm));
              });
            }
          }
        });
      }

      // Map permissions to allowed routes
      const allowedRoutes = this.mapPermissionsToRoutes(Array.from(permissions));

      const info: UserPermissionInfo = {
        profileId: profile.id,
        profileName: profile.profileName,
        email: profile.email || '',
        appScope: profile.appScope || 'unknown',
        roles: roleNames,
        permissions: Array.from(permissions),
        allowedRoutes
      };

      this.selectedPermissionInfo.set(info);
      this.loading.set(false);
    } catch (err: any) {
      this.error.set('Failed to inspect profile: ' + err.message);
      this.loading.set(false);
    }
  }

  async inspectAllProfiles(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const profiles = this.profiles();
      
      // Process all profiles concurrently for better performance
      const profilePromises = profiles.map(async (profile) => {
        try {
          const roles = await firstValueFrom(this.rolesService.getUserRoles(profile.id));
          
          const permissions = new Set<string>();
          const roleNames: string[] = [];
          
          if (roles && Array.isArray(roles)) {
            (roles as RoleAssignmentResponse[]).forEach((roleAssignment) => {
              if (roleAssignment.role) {
                roleNames.push(roleAssignment.role.name);
                if (roleAssignment.role.permissions) {
                  roleAssignment.role.permissions.forEach((perm) => {
                    permissions.add(this.getPermissionName(perm));
                  });
                }
              }
            });
          }

          const allowedRoutes = this.mapPermissionsToRoutes(Array.from(permissions));

          return {
            profileId: profile.id,
            profileName: profile.profileName,
            email: profile.email || '',
            appScope: profile.appScope || 'unknown',
            roles: roleNames,
            permissions: Array.from(permissions),
            allowedRoutes
          };
        } catch (err) {
          console.error(`Failed to inspect profile ${profile.id}:`, err);
          // Return minimal info if inspection fails
          return {
            profileId: profile.id,
            profileName: profile.profileName,
            email: profile.email || '',
            appScope: profile.appScope || 'unknown',
            roles: [],
            permissions: [],
            allowedRoutes: []
          };
        }
      });

      const allData = await Promise.allSettled(profilePromises);
      const successfulResults = allData
        .filter((result): result is PromiseFulfilledResult<UserPermissionInfo> => result.status === 'fulfilled')
        .map(result => result.value);

      this.allProfilesData.set(successfulResults);
      this.loading.set(false);
    } catch (err: any) {
      this.error.set('Failed to inspect all profiles: ' + err.message);
      this.loading.set(false);
    }
  }

  async findUnusedItems(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      // Get all permissions and roles
      const [allPermissions, allRoles] = await Promise.all([
        firstValueFrom(this.permissionsService.getPermissions()),
        firstValueFrom(this.rolesService.getRoles())
      ]);

      // Get all role assignments for all profiles concurrently
      const profiles = this.profiles();
      const usedRoleIds = new Set<string>();
      const usedPermissionIds = new Set<string>();

      const rolePromises = profiles.map(async (profile) => {
        try {
          const roles = await firstValueFrom(this.rolesService.getUserRoles(profile.id));
          if (roles && Array.isArray(roles)) {
            (roles as RoleAssignmentResponse[]).forEach((roleAssignment) => {
              if (roleAssignment.role) {
                usedRoleIds.add(roleAssignment.role.id);
                if (roleAssignment.role.permissions) {
                  roleAssignment.role.permissions.forEach((perm) => {
                    usedPermissionIds.add(perm.id);
                  });
                }
              }
            });
          }
        } catch (err) {
          console.error(`Failed to get roles for profile ${profile.id}:`, err);
        }
      });

      await Promise.allSettled(rolePromises);

      const unused: UnusedInfo[] = [];

      // Find unused permissions
      if (allPermissions) {
        allPermissions.forEach((perm: PermissionDto) => {
          if (!usedPermissionIds.has(perm.id)) {
            unused.push({
              type: 'permission',
              name: perm.name,
              id: perm.id,
              description: perm.description || '',
              usageCount: 0
            });
          }
        });
      }

      // Find unused roles
      if (allRoles) {
        allRoles.forEach((role: RoleDto) => {
          if (!usedRoleIds.has(role.id)) {
            unused.push({
              type: 'role',
              name: role.name,
              id: role.id,
              description: role.description || '',
              usageCount: 0
            });
          }
        });
      }

      this.unusedItems.set(unused);
      this.loading.set(false);
    } catch (err: any) {
      this.error.set('Failed to find unused items: ' + err.message);
      this.loading.set(false);
    }
  }

  private mapPermissionsToRoutes(permissions: string[]): string[] {
    const routes: string[] = [];
    
    // Map common permissions to their corresponding routes
    const permissionRouteMap: { [key: string]: string[] } = {
      'profile.read': ['GET /api/profile/:id', 'GET /api/profile'],
      'profile.update': ['PUT /api/profile/:id'],
      'profile.delete': ['DELETE /api/profile/:id'],
      'asset.create': ['POST /api/asset'],
      'asset.read': ['GET /api/asset/:id', 'GET /api/asset'],
      'asset.update': ['PUT /api/asset/:id'],
      'asset.delete': ['DELETE /api/asset/:id'],
      'social.post.create': ['POST /api/social/post'],
      'social.post.read': ['GET /api/social/post/:id', 'GET /api/social/post'],
      'social.post.update': ['PUT /api/social/post/:id'],
      'social.post.delete': ['DELETE /api/social/post/:id'],
      'social.follow': ['POST /api/social/follow', 'DELETE /api/social/follow/:id'],
      'blog.post.create': ['POST /api/blogging/post'],
      'blog.post.read': ['GET /api/blogging/post/:id', 'GET /api/blogging/post'],
      'blog.post.update': ['PUT /api/blogging/post/:id'],
      'blog.post.delete': ['DELETE /api/blogging/post/:id'],
      'project.create': ['POST /api/project-planning/project'],
      'project.read': ['GET /api/project-planning/project/:id'],
      'project.update': ['PUT /api/project-planning/project/:id'],
      'task.create': ['POST /api/project-planning/task'],
      'task.read': ['GET /api/project-planning/task/:id'],
      'task.update': ['PUT /api/project-planning/task/:id']
    };

    permissions.forEach(permission => {
      const mappedRoutes = permissionRouteMap[permission];
      if (mappedRoutes) {
        routes.push(...mappedRoutes);
      }
    });

    return [...new Set(routes)]; // Remove duplicates
  }

  private getPermissionName(perm: PermissionResponse): string {
    return perm.name || perm.action || 'unknown';
  }
}

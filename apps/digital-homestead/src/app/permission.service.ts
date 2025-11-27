import { Injectable, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, firstValueFrom, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

import { AuthStateService } from './auth-state.service';

export interface RoleDto {
  id: string;
  name: string;
  description: string;
  appScope?: string;
}

export interface PermissionDto {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  targetId?: string;
}

export interface UserRolesResponse {
  profileId: string;
  roles: RoleDto[];
  permissions: PermissionDto[];
}

/**
 * Service to check user permissions for the digital-homestead app.
 * Determines if the user has owner/full access permissions for blog editing.
 */
@Injectable({
  providedIn: 'root',
})
export class PermissionService implements OnDestroy {
  private http: HttpClient = inject(HttpClient);
  private authState: AuthStateService = inject(AuthStateService);
  private platformId: object = inject(PLATFORM_ID);

  private userRolesSubject = new BehaviorSubject<UserRolesResponse | null>(null);
  private hasFullAccessSubject = new BehaviorSubject<boolean>(false);
  private permissionsLoadedSubject = new BehaviorSubject<boolean>(false);
  private authSubscription: Subscription | null = null;

  // Roles that grant full blog editing access
  private readonly OWNER_ROLES = ['digital_homesteader', 'owner', 'admin', 'blog_author'];
  
  // Permission names that grant blog writing access
  private readonly WRITE_PERMISSIONS = [
    'blog.post.create',
    'blog.post.update',
    'blog.post.delete',
  ];

  constructor() {
    // Load permissions when user is authenticated
    this.authSubscription = this.authState.isAuthenticated$().subscribe((isAuth) => {
      if (isAuth) {
        this.loadUserPermissions();
      } else {
        this.clearPermissions();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  /**
   * Observable that emits whether the current user has full blog access
   */
  hasFullAccess$(): Observable<boolean> {
    return this.hasFullAccessSubject.asObservable();
  }

  /**
   * Observable that emits when permissions have been loaded
   */
  permissionsLoaded$(): Observable<boolean> {
    return this.permissionsLoadedSubject.asObservable();
  }

  /**
   * Synchronous check for full access (returns cached value)
   */
  get hasFullAccess(): boolean {
    return this.hasFullAccessSubject.value;
  }

  /**
   * Check if permissions have been loaded
   */
  get permissionsLoaded(): boolean {
    return this.permissionsLoadedSubject.value;
  }

  /**
   * Load user permissions from the backend
   */
  async loadUserPermissions(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      this.hasFullAccessSubject.next(false);
      this.permissionsLoadedSubject.next(true);
      return;
    }

    const profileId = this.authState.getProfileId();
    if (!profileId) {
      this.hasFullAccessSubject.next(false);
      this.permissionsLoadedSubject.next(true);
      return;
    }

    // Validate and encode profileId to prevent path traversal/injection
    const encodedProfileId = encodeURIComponent(profileId);

    try {
      const response = await firstValueFrom(
        this.http.get<UserRolesResponse>(`/api/permissions/user-roles/${encodedProfileId}`).pipe(
          catchError((error) => {
            console.error('Failed to load user permissions:', error);
            return of(null);
          })
        )
      );

      if (response) {
        this.userRolesSubject.next(response);
        const hasAccess = this.checkFullAccess(response);
        this.hasFullAccessSubject.next(hasAccess);
      } else {
        this.hasFullAccessSubject.next(false);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      this.hasFullAccessSubject.next(false);
    } finally {
      this.permissionsLoadedSubject.next(true);
    }
  }

  /**
   * Check if a user has a specific permission
   */
  hasPermission(permissionName: string): boolean {
    const userRoles = this.userRolesSubject.value;
    if (!userRoles) return false;

    return userRoles.permissions.some((p) => p.name === permissionName);
  }

  /**
   * Check if a user has any of the specified roles
   */
  hasRole(roleName: string): boolean {
    const userRoles = this.userRolesSubject.value;
    if (!userRoles) return false;

    return userRoles.roles.some((r) => r.name === roleName);
  }

  /**
   * Check if user has any of the owner/full access roles or write permissions
   */
  private checkFullAccess(userRoles: UserRolesResponse): boolean {
    // Check for owner/admin roles
    const hasOwnerRole = userRoles.roles.some((role) =>
      this.OWNER_ROLES.includes(role.name)
    );
    if (hasOwnerRole) return true;

    // Check for write permissions
    const hasWritePermission = userRoles.permissions.some((perm) =>
      this.WRITE_PERMISSIONS.includes(perm.name)
    );
    return hasWritePermission;
  }

  /**
   * Clear cached permissions (on logout)
   */
  private clearPermissions(): void {
    this.userRolesSubject.next(null);
    this.hasFullAccessSubject.next(false);
    this.permissionsLoadedSubject.next(false);
  }

  /**
   * Refresh permissions from the backend
   */
  async refreshPermissions(): Promise<void> {
    this.permissionsLoadedSubject.next(false);
    await this.loadUserPermissions();
  }
}

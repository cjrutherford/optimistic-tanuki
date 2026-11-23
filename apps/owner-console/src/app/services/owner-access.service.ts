import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Roles that open the Owner Console. This mirrors the gateway's
 * `assertPrivilegedScopeAccess`; the server stays the authority and this only
 * lets the UI explain a refusal instead of showing pages that will 403.
 */
export const OWNER_CONSOLE_ROLES: readonly string[] = [
  'owner_console_owner',
  'owner',
  'global_admin',
  'system_admin',
];

export type OwnerAccessStatus =
  /** The account holds an owner role. */
  | 'owner'
  /** The account is signed in but holds no owner role. */
  | 'denied'
  /** Roles could not be read; the server decides on each request. */
  | 'unverified';

export interface OwnerAccess {
  status: OwnerAccessStatus;
  /** Owner roles grant every permission. */
  all: boolean;
  permissions: ReadonlySet<string>;
}

interface RoleAssignment {
  role?: {
    name?: string;
    permissions?: Array<{ name?: string } | string>;
  };
}

const DENIED: OwnerAccess = {
  status: 'denied',
  all: false,
  permissions: new Set(),
};

/**
 * Client-side view of what the signed-in owner may do. Roles come from the
 * gateway's `permissions/user-roles/:profileId` route for the owner-console
 * scope. A 403 (or no owner role) means no access.
 */
@Injectable({ providedIn: 'root' })
export class OwnerAccessService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private cached?: Observable<OwnerAccess>;
  private current: OwnerAccess = DENIED;

  load(): Observable<OwnerAccess> {
    this.cached ??= this.fetch().pipe(shareReplay(1));
    return this.cached;
  }

  /** Forget the cached answer, e.g. after sign-out. */
  reset(): void {
    this.cached = undefined;
    this.current = DENIED;
  }

  /** Whether the loaded access grants a permission. Loads nothing itself. */
  can = (permission?: string): boolean =>
    !permission ||
    this.current.status === 'unverified' ||
    this.current.all ||
    this.current.permissions.has(permission);

  private fetch(): Observable<OwnerAccess> {
    const profileId = this.auth.getSessionUser()?.profileId;
    if (!profileId) {
      return of(this.remember(DENIED));
    }
    return this.http
      .get<RoleAssignment[]>(
        `/api/permissions/user-roles/${encodeURIComponent(profileId)}`,
        { params: { appScope: 'owner-console' } }
      )
      .pipe(
        map((assignments) => this.remember(this.toAccess(assignments))),
        catchError((error: { status?: number }) =>
          of(
            this.remember(
              error?.status === 403 || error?.status === 401
                ? DENIED
                : { status: 'unverified', all: true, permissions: new Set() }
            )
          )
        )
      );
  }

  private remember(access: OwnerAccess): OwnerAccess {
    this.current = access;
    return access;
  }

  private toAccess(assignments: RoleAssignment[] | null): OwnerAccess {
    const roles = Array.isArray(assignments)
      ? assignments.map((a) => a.role).filter((role) => !!role)
      : [];
    const all = roles.some((role) =>
      OWNER_CONSOLE_ROLES.includes(role?.name ?? '')
    );
    if (!all) {
      return DENIED;
    }
    const permissions = new Set(
      roles.flatMap((role) =>
        (role?.permissions ?? []).map((p) =>
          typeof p === 'string' ? p : p.name ?? ''
        )
      )
    );
    return { status: 'owner', all, permissions };
  }
}

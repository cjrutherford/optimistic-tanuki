import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { CommunityService } from '../services/community.service';
import { firstValueFrom } from 'rxjs';
import { localityRouteContext } from '../utils/locality-route-context';

/**
 * Ensures the requesting user is both authenticated and a member of the
 * community identified by the `:slug` route parameter.
 *
 * - Not authenticated → redirect to /login (with returnUrl)
 * - Authenticated but not a member → redirect to /c/:slug
 */
@Injectable({
  providedIn: 'root',
})
export class MemberGuard implements CanActivate {
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private communityService = inject(CommunityService);
  private platformId = inject(PLATFORM_ID);

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    // The Express SSR gate has already validated the gateway session. Browser
    // navigation still restores auth state and verifies membership below; API
    // authorization remains enforced by gateway guards.
    if (isPlatformServer(this.platformId)) {
      return true;
    }

    try {
      await this.authState.waitForSessionRestore();
    } catch {
      // Treat a failed session check as unauthenticated.
    }
    const isAuthenticated = await firstValueFrom(
      this.authState.isAuthenticated$
    );

    if (!isAuthenticated) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.buildReturnUrl(route) },
      });
      return false;
    }

    const { slug, baseSegments } = localityRouteContext(route.paramMap);
    if (!slug) {
      this.router.navigate(['/communities']);
      return false;
    }

    try {
      const community = await this.communityService.getCommunityBySlug(slug);
      if (!community) {
        this.router.navigate(['/communities']);
        return false;
      }

      const isMember = await this.communityService.isMember(community.id);
      if (!isMember) {
        this.router.navigate(baseSegments);
        return false;
      }

      return true;
    } catch (error) {
      console.error(
        'MemberGuard: membership check failed for slug:',
        slug,
        error
      );
      this.router.navigate(baseSegments);
      return false;
    }
  }

  private buildReturnUrl(route: ActivatedRouteSnapshot): string {
    const segments: string[] = [];
    let current: ActivatedRouteSnapshot | null = route;
    while (current) {
      segments.unshift(...current.url.map((s) => s.path));
      current = current.parent;
    }
    return '/' + segments.join('/');
  }
}

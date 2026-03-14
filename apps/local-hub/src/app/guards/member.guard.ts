import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
} from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { CommunityService } from '../services/community.service';
import { firstValueFrom } from 'rxjs';

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

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const isAuthenticated = await firstValueFrom(
      this.authState.isAuthenticated$
    );

    if (!isAuthenticated) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.buildReturnUrl(route) },
      });
      return false;
    }

    const slug = route.paramMap.get('slug') ?? '';

    try {
      const community = await this.communityService.getCommunityBySlug(slug);
      if (!community) {
        this.router.navigate(['/communities']);
        return false;
      }

      const isMember = await this.communityService.isMember(community.id);
      if (!isMember) {
        this.router.navigate(['/c', slug]);
        return false;
      }

      return true;
    } catch (error) {
      console.error('MemberGuard: membership check failed for slug:', slug, error);
      this.router.navigate(['/c', slug]);
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

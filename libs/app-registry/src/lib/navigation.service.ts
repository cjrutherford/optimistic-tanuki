import { Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { AppRegistryService } from './app-registry.service';
import { DEFAULT_NAVIGATION_LINKS } from './default-links';
import {
  GeneratedLink,
  NavigationContext,
  NavigationLink,
  NavigationOptions,
} from './navigation.types';

const RETURN_TO_STORAGE_KEY = 'ot.registry.returnTo';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private readonly registry: AppRegistryService) {}

  getLinks(appId: string): Observable<NavigationLink[]> {
    return this.getFilteredRawLinks(appId, undefined);
  }

  getFilteredLinks(context: NavigationContext): Observable<GeneratedLink[]> {
    return this.getFilteredRawLinks(context.currentAppId, context).pipe(
      map((links) =>
        links
          .map((link) => this.toGeneratedLink(link))
          .filter((link): link is GeneratedLink => !!link)
      )
    );
  }

  generateUrl(
    targetAppId: string,
    path?: string,
    queryParams?: Record<string, string>
  ): string {
    return this.registry.getAppUrl(targetAppId, path, queryParams);
  }

  navigate(
    targetAppId: string,
    path?: string,
    options: NavigationOptions = {}
  ): void {
    if (!this.isBrowser) {
      return;
    }
    const queryParams = this.returnParams(options);
    const url = this.generateUrl(targetAppId, path, queryParams);

    if (options.newTab) {
      window.open(url, '_blank');
      return;
    }

    window.location.href = url;
  }

  openNewTab(
    targetAppId: string,
    path?: string,
    queryParams?: Record<string, string>
  ): void {
    if (!this.isBrowser) {
      return;
    }
    window.open(this.generateUrl(targetAppId, path, queryParams), '_blank');
  }

  getReturnLink(context: NavigationContext): string {
    return this.registry.getAppUrl(context.currentAppId, context.currentPath, {
      returnTo: this.isBrowser ? this.currentBrowserUrl() : '',
    });
  }

  captureReturnTo(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    const returnTo = this.currentSearchParams().get('returnTo');
    if (!returnTo) {
      return null;
    }

    sessionStorage.setItem(RETURN_TO_STORAGE_KEY, returnTo);
    return returnTo;
  }

  consumeReturnTo(): string | null {
    const returnTo = sessionStorage.getItem(RETURN_TO_STORAGE_KEY);
    if (!returnTo) {
      return null;
    }

    sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
    return returnTo;
  }

  private getFilteredRawLinks(
    appId: string,
    context?: NavigationContext
  ): Observable<NavigationLink[]> {
    return this.registry.getAllApps().pipe(
      map(() =>
        DEFAULT_NAVIGATION_LINKS.filter((link) => {
          if (link.sourceAppId !== appId) {
            return false;
          }

          if (link.requiresAuth && !context?.isAuthenticated) {
            return false;
          }

          return true;
        }).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
      )
    );
  }

  private toGeneratedLink(link: NavigationLink): GeneratedLink | null {
    const target = (this.registry as any).defaultRegistry?.apps?.find(
      (app: { appId: string }) => app.appId === link.targetAppId
    );
    const fallbackTarget = {
      appId: link.targetAppId,
      name: link.label,
      domain: '',
      uiBaseUrl: '',
      apiBaseUrl: '',
      appType: 'client',
      visibility: 'public',
    } as GeneratedLink['target'];

    return {
      url: this.generateUrl(link.targetAppId, link.path, link.queryParams),
      target: target ?? fallbackTarget,
      meta: {
        label: link.label,
        iconName: link.iconName,
        opensNewTab: false,
      },
    };
  }

  private returnParams(
    options: NavigationOptions
  ): Record<string, string> | undefined {
    if (!this.isBrowser) {
      return undefined;
    }
    if (options.preserveQuery) {
      return { returnTo: window.location.pathname + window.location.search };
    }

    if (options.includeReturn) {
      return { returnTo: window.location.pathname };
    }

    return undefined;
  }

  private currentBrowserUrl(): string {
    if (!this.isBrowser) {
      return '';
    }
    return `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  private currentSearchParams(): URLSearchParams {
    if (!this.isBrowser) {
      return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
  }
}

export const NAVIGATION_SERVICE = new InjectionToken<NavigationService>(
  'NAVIGATION_SERVICE'
);

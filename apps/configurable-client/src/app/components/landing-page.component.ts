import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConfigurationService } from '../services/configuration.service';
import { AuthSessionService } from '../services/auth-session.service';
import { PublishedAppConfiguration } from '@optimistic-tanuki/app-config-models';
import { PublishedAppShellComponent } from '@optimistic-tanuki/configurable-client-ui';
import { PUBLISHED_FEATURE_REGISTRY } from './published-feature-registry';

function normalizedPath(url: string): string {
  const path = url.split('?')[0].replace(/\/$/, '');
  return path || '/';
}

/** Base href for links that must remain within the published app doorway. */
export function publishedAppBasePath(url: string): string {
  const segments = normalizedPath(url).split('/').filter(Boolean);
  const contextIndex = segments.findIndex(
    (segment) => segment === 'app' || segment === 'config'
  );
  return contextIndex >= 0 && segments.length > contextIndex + 1
    ? `/${segments.slice(0, contextIndex + 2).join('/')}`
    : '/';
}

/** Feature path consumed by the shell after removing app/config identity. */
export function publishedAppFeaturePath(url: string): string {
  const segments = normalizedPath(url).split('/').filter(Boolean);
  const contextIndex = segments.findIndex(
    (segment) => segment === 'app' || segment === 'config'
  );
  const featureSegments =
    contextIndex >= 0 ? segments.slice(contextIndex + 2) : segments;
  return featureSegments.length ? `/${featureSegments.join('/')}` : '/';
}

@Component({
  selector: 'app-configurable-client-landing-page-shell',
  standalone: true,
  imports: [CommonModule, PublishedAppShellComponent],
  template: `
    @if (resolvedConfig; as appConfig) {
    <otui-published-app-shell
      [config]="appConfig"
      [signedIn]="signedIn"
      [activePath]="activePath"
      [basePath]="basePath"
      [featureRegistry]="featureRegistry"
    ></otui-published-app-shell>
    }
  `,
})
export class LandingPageComponent implements OnInit, OnChanges {
  @Input() config: PublishedAppConfiguration | null = null;
  @Input() embeddedPreview = false;

  resolvedConfig: PublishedAppConfiguration | null = null;
  readonly featureRegistry = PUBLISHED_FEATURE_REGISTRY;

  constructor(
    private readonly configService: ConfigurationService,
    private readonly auth: AuthSessionService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.syncConfig();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.syncConfig();
    }
  }

  private syncConfig(): void {
    this.resolvedConfig =
      this.config ?? this.configService.getCurrentConfiguration();
  }

  get signedIn(): boolean {
    return this.auth.status === 'signed-in';
  }

  get activePath(): string {
    return publishedAppFeaturePath(this.router.url);
  }

  get basePath(): string {
    return publishedAppBasePath(this.router.url);
  }
}

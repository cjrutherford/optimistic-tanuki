# Application Registry and Navigation Plan

## Objective

Centralized application registry providing cross-app navigation for all HAI client/user/admin-facing Angular applications, enabling consistent linking between hai (haidev.com) and system-configurator (haicomputer.com).

---

## Overview

### Problem Statement

HAI operates multiple Angular applications across different domains:
- **hai** at haidev.com (company website)
- **system-configurator** at haicomputer.com (BTO platform)
- Additional apps: store, leads, billing, owner-console, etc.

These applications need to link to each other reliably, requiring a single source of truth for:
- Application domains
- API endpoints
- Navigation paths
- Authentication state

### Solution

Two-tier configuration system:
1. **Build-time**: JSON bundled into Angular at build
2. **Runtime**: Served from gateway for live updates

---

## Registry Generation CLI

The registry JSON is generated and managed via a Go CLI tool in `tools/`.

### Tool Structure

```
tools/
└── cmd/
    └── registry/
        ├── main.go           # CLI entry point
        ├── generate.go        # Generate command
        ├── validate.go        # Validate command
        ├── add.go            # Add app command
        ├── remove.go         # Remove app command
        └── templates/
            └── registry.tmpl  # Output template
```

### Commands

```bash
# Generate registry JSON
registry generate --output libs/app-registry/src/lib/default-registry.json

# Validate registry
registry validate --file libs/app-registry/src/lib/default-registry.json

# Add new application
registry add --appId store --name "HAI Store" --domain haidev.com --subdomain store

# Remove application
registry remove --appId legacy-app

# Export for gateway
registry export --format env > .env.registry
```

### Registry Source

Applications are defined in a YAML configuration file:

```yaml
# tools/registry/apps.yaml
version: "1.0.0"

apps:
  - appId: hai
    name: HAI Company Website
    domain: haidev.com
    uiBaseUrl: https://haidev.com
    apiBaseUrl: https://api.haidev.com
    appType: client
    visibility: public
    sortOrder: 1

  - appId: system-configurator
    name: HAI Computer System Configurator
    domain: haicomputer.com
    uiBaseUrl: https://haicomputer.com
    apiBaseUrl: https://api.haicomputer.com
    appType: client
    visibility: public
    sortOrder: 2

  - appId: store
    name: HAI Store
    domain: haidev.com
    subdomain: store
    uiBaseUrl: https://store.haidev.com
    apiBaseUrl: https://api.haidev.com
    appType: client
    visibility: public
    sortOrder: 3
```

### Go Implementation

```go
// File: tools/cmd/registry/main.go

package main

import (
    "fmt"
    "os"

    "github.com/spf13/cobra"
)

func main() {
    root := &cobra.Command{
        Use:   "registry",
        Short: "Application registry management CLI",
    }

    root.AddCommand(generateCmd())
    root.AddCommand(validateCmd())
    root.AddCommand(addCmd())
    root.AddCommand(removeCmd())

    if err := root.Execute(); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
}
```

```go
// File: tools/cmd/registry/generate.go

package main

import (
    "encoding/json"
    "fmt"
    "os"
    "text/template"
    "time"

    "github.com/spf13/cobra"
    "gopkg.in/yaml.v3"
)

type AppConfig struct {
    AppID    string `yaml:"appId"`
    Name    string `yaml:"name"`
    Domain  string `yaml:"domain"`
    Subdomain string `yaml:"subdomain,omitempty"`
    UiBaseUrl string `yaml:"uiBaseUrl"`
    ApiBaseUrl string `yaml:"apiBaseUrl"`
    AppType string `yaml:"appType"`
    Visibility string `yaml:"visibility"`
    Description string `yaml:"description,omitempty"`
    IconUrl string `yaml:"iconUrl,omitempty"`
    SortOrder int `yaml:"sortOrder,omitempty"`
}

type RegistryConfig struct {
    Version string `yaml:"version"`
    Apps []AppConfig `yaml:"apps"`
}

type OutputRegistry struct {
    Version string `json:"version"`
    GeneratedAt string `json:"generatedAt"`
    Apps []OutputApp `json:"apps"`
}

type OutputApp struct {
    AppID string `json:"appId"`
    Name string `json:"name"`
    Domain string `json:"domain"`
    Subdomain string `json:"subdomain,omitempty"`
    UiBaseUrl string `json:"uiBaseUrl"`
    ApiBaseUrl string `json:"apiBaseUrl"`
    AppType string `json:"appType"`
    Visibility string `json:"visibility"`
    Description string `json:"description,omitempty"`
    IconUrl string `json:"iconUrl,omitempty"`
    SortOrder int `json:"sortOrder,omitempty"`
}

var generateCmd = func() *cobra.Command {
    var inputFile string
    var outputFile string

    cmd := &cobra.Command{
        Use:   "generate",
        Short: "Generate registry JSON from YAML source",
        RunE: func(cmd *cobra.Command, args []string) error {
            data, err := os.ReadFile(inputFile)
            if err != nil {
                return fmt.Errorf("reading input: %w", err)
            }

            var cfg RegistryConfig
            if err := yaml.Unmarshal(data, &cfg); err != nil {
                return fmt.Errorf("parsing YAML: %w", err)
            }

            output := OutputRegistry{
                Version: cfg.Version,
                GeneratedAt: time.Now().UTC().Format(time.RFC3339),
                Apps: make([]OutputApp, len(cfg.Apps)),
            }

            for i, app := range cfg.Apps {
                output.Apps[i] = OutputApp{
                    AppID: app.AppID,
                    Name: app.Name,
                    Domain: app.Domain,
                    Subdomain: app.Subdomain,
                    UiBaseUrl: computeUiBaseUrl(app),
                    ApiBaseUrl: app.ApiBaseUrl,
                    AppType: app.AppType,
                    Visibility: app.Visibility,
                    Description: app.Description,
                    IconUrl: app.IconUrl,
                    SortOrder: app.SortOrder,
                }
            }

            jsonData, err := json.MarshalIndent(output, "", "  ")
            if err != nil {
                return fmt.Errorf("marshaling JSON: %w", err)
            }

            if outputFile != "" {
                return os.WriteFile(outputFile, jsonData, 0644)
            }

            fmt.Println(string(jsonData))
            return nil
        },
    }

    cmd.Flags().StringVar(&inputFile, "input", "tools/registry/apps.yaml", "Input YAML file")
    cmd.Flags().StringVar(&outputFile, "output", "", "Output JSON file (empty for stdout)")

    return cmd
}

func computeUiBaseUrl(app AppConfig) string {
    if app.UiBaseUrl != "" {
        return app.UiBaseUrl
    }
    if app.Subdomain != "" {
        return fmt.Sprintf("https://%s.%s", app.Subdomain, app.Domain)
    }
    return fmt.Sprintf("https://%s", app.Domain)
}
```

### Workflow

```bash
# 1. Edit YAML source
vim tools/registry/apps.yaml

# 2. Generate registry JSON
go run tools/cmd/registry/main.go generate \
    --input tools/registry/apps.yaml \
    --output libs/app-registry/src/lib/default-registry.json

# 3. Commit changes
git add libs/app-registry/src/lib/default-registry.json
git commit -m "chore: update app registry"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Build-Time Config                                      │  │
│  │  libs/app-registry/src/default-registry.json           │  │
│  │  - Bundled into Angular at build                      │  │
│  │  - Provides offline/bootstrapping values              │  │
│  │  - Default app mappings for all client apps          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           │                                │
│                           ▼                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Runtime Config (Gateway)                             │  │
│  │  GET /api/registry/apps                             │  │
│  │  - Served from gateway on init                      │  │
│  │  - Can update without app rebuild                  │  │
│  │  - Angular service polls for refresh               │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Angular Applications                                 │  │
│  │  hai ◄───────────────────────► system-configurator    │  │
│  │  haidev.com                haicomputer.com             │  │
│  │                          store.haidev.com           │  │
│  │                          leads.haidev.com           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Types and Schemas

### Core Types

```typescript
// File: libs/app-registry/src/lib/app-registry.types.ts

/**
 * Visibility level for application registration.
 * - public: Accessible externally via domain
 * - internal: Internal tools requiring authentication
 */
export type AppVisibility = 'public' | 'internal';

/**
 * Type of application frontend.
 * - client: Customer-facing web application
 * - admin: Admin/management interface
 * - user: Authenticated user dashboard
 */
export type AppType = 'client' | 'admin' | 'user';

/**
 * Single application registration entry.
 */
export interface AppRegistration {
  /** Unique identifier for the application */
  appId: string;
  
  /** Human-readable application name */
  name: string;
  
  /** Primary domain (e.g., 'haidev.com') */
  domain: string;
  
  /** Optional subdomain prefix (e.g., 'store' → store.haidev.com) */
  subdomain?: string;
  
  /** Full computed URL: [subdomain.][domain] */
  uiBaseUrl: string;
  
  /** API gateway base URL */
  apiBaseUrl: string;
  
  /** Application type classification */
  appType: AppType;
  
  /** Visibility level */
  visibility: AppVisibility;
  
  /** Optional description */
  description?: string;
  
  /** Optional icon/logo */
  iconUrl?: string;
  
  /** Feature flags specific to this app */
  features?: Record<string, boolean>;
  
  /** Sort order for listings */
  sortOrder?: number;
  
  /** Timestamp */
  updatedAt?: string;
}

/**
 * Registry manifest.
 */
export interface AppRegistry {
  version: string;
  generatedAt: string;
  apps: AppRegistration[];
}

/**
 * Response from gateway.
 */
export interface AppRegistryResponse {
  success: boolean;
  data: AppRegistry;
  error?: string;
}
```

### Navigation Types

```typescript
// File: libs/app-registry/src/lib/navigation.types.ts

/**
 * Navigation link between applications.
 */
export interface NavigationLink {
  linkId: string;
  sourceAppId: string;
  targetAppId: string;
  type: NavigationLinkType;
  label: string;
  path?: string;
  queryParams?: Record<string, string>;
  requiresAuth?: boolean;
  position?: 'primary' | 'secondary' | 'footer';
  sortOrder?: number;
  iconName?: string;
  featureFlag?: string;
}

/**
 * Types of navigation links.
 */
export type NavigationLinkType = 'nav' | 'action' | 'footer' | 'context';

/**
 * Context for generating navigation.
 */
export interface NavigationContext {
  currentAppId: string;
  currentPath: string;
  isAuthenticated: boolean;
  userId?: string;
  queryParams?: Record<string, string>;
}

/**
 * Generated navigation URL.
 */
export interface GeneratedLink {
  url: string;
  target: AppRegistration;
  meta: {
    label: string;
    iconName?: string;
    opensNewTab: boolean;
  };
}
```

---

## App Registration Mapping

### Client/User/Admin Applications

| App ID | Name | Domain | Visibility | Type |
|-------|------|--------|-----------|------|
| hai | HAI Company Website | haidev.com | public | client |
| system-configurator | HAI Computer | haicomputer.com | public | client |
| store | HAI Store | store.haidev.com | public | client |
| leads | Lead Tracker | leads.haidev.com | public | client |
| billing | Billing Portal | billing.haidev.com | public | client |
| owner-console | Owner Console | owner.haidev.com | internal | admin |
| profile | User Profile | profile.haidev.com | internal | user |
| auth | Authentication | auth.haidev.com | internal | client |

### Navigation Links

```json
// Default links bundled with registry
{
  "links": [
    {
      "linkId": "hai-to-configurator",
      "sourceAppId": "hai",
      "targetAppId": "system-configurator",
      "type": "nav",
      "label": "Build a System",
      "path": "/build/new",
      "position": "primary",
      "sortOrder": 1,
      "iconName": "computer"
    },
    {
      "linkId": "configurator-to-hai",
      "sourceAppId": "system-configurator",
      "targetAppId": "hai",
      "type": "nav",
      "label": "Home",
      "path": "/",
      "position": "primary",
      "sortOrder": 0
    },
    {
      "linkId": "hai-footer-store",
      "sourceAppId": "hai",
      "targetAppId": "store",
      "type": "footer",
      "label": "Store",
      "position": "footer"
    },
    {
      "linkId": "hai-footer-leads",
      "sourceAppId": "hai",
      "targetAppId": "leads",
      "type": "footer",
      "label": "Lead Tracker",
      "position": "footer"
    }
  ]
}
```

---

## Services

### Angular Registry Service

```typescript
// File: libs/app-registry/src/lib/app-registry.service.ts

import { Injectable, InjectionToken } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, timer } from 'rxjs';
import { switchMap, shareReplay } from 'rxjs/operators';
import { AppRegistration } from './app-registry.types';

export interface AppRegistryService {
  getAllApps(): Observable<AppRegistration[]>;
  getApp(appId: string): Observable<AppRegistration | null>;
  getAppByDomain(domain: string): Observable<AppRegistration | null>;
  getPublicApps(): Observable<AppRegistration[]>;
  getInternalApps(): Observable<AppRegistration[]>;
  refresh(): Observable<AppRegistry>;
  getAppUrl(appId: string, path?: string, queryParams?: Record<string, string>): string;
  isAppAccessible(appId: string): boolean;
  registryVersion: string;
}

@Injectable()
export class AppRegistryServiceImpl implements AppRegistryService {
  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  private readonly registry$: Observable<AppRegistry>;

  constructor(
    private readonly http: HttpClient,
    private readonly defaultRegistry: AppRegistry,
    private readonly gatewayUrl: string
  ) {
    this.registry$ = this.refresh$.pipe(
      switchMap(() => this.fetchFromGateway()),
      shareReplay(1)
    );
  }

  getAllApps(): Observable<AppRegistration[]> {
    return this.registry$.pipe(
      switchMap(r => of(r.apps))
    );
  }

  getApp(appId: string): Observable<AppRegistration | null> {
    return this.getAllApps().pipe(
      switchMap(apps => of(apps.find(a => a.appId === appId) ?? null))
    );
  }

  getAppUrl(
    appId: string,
    path?: string,
    queryParams?: Record<string, string>
  ): string {
    const app = this.defaultRegistry.apps.find(a => a.appId === appId);
    if (!app) return '/';

    let url = app.uiBaseUrl;
    if (path) {
      url += path.startsWith('/') ? path : `/${path}`;
    }
    if (queryParams) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }
    return url;
  }

  refresh(): Observable<AppRegistry> {
    this.refresh$.next();
    return this.registry$;
  }

  private fetchFromGateway(): Observable<AppRegistry> {
    return this.http.get<AppRegistryResponse>(`${this.gatewayUrl}/api/registry/apps`).pipe(
      map(r => r.success ? r.data : this.defaultRegistry),
      catchError(() => of(this.defaultRegistry))
    );
  }
}

export const APP_REGISTRY = new InjectionToken<AppRegistryService>('APP_REGISTRY');
```

### Angular Navigation Service

```typescript
// File: libs/app-registry/src/lib/navigation.service.ts

import { Injectable } from '@angular/core';
import { AppRegistryService } from './app-registry.service';
import { NavigationLink, NavigationContext, GeneratedLink } from './navigation.types';

export interface NavigationService {
  getLinks(appId: string): Observable<NavigationLink[]>;
  getFilteredLinks(context: NavigationContext): Observable<GeneratedLink[]>;
  generateUrl(
    targetAppId: string,
    path?: string,
    queryParams?: Record<string, string>
  ): string;
  navigate(
    targetAppId: string,
    path?: string,
    options?: NavigationOptions
  ): void;
  openNewTab(
    targetAppId: string,
    path?: string,
    queryParams?: Record<string, string>
  ): void;
  getReturnLink(context: NavigationContext): string;
}

export interface NavigationOptions {
  newTab?: boolean;
  includeReturn?: boolean;
  preserveQuery?: boolean;
}

@Injectable()
export class NavigationServiceImpl implements NavigationService {
  constructor(
    private readonly registry: AppRegistryService
  ) {}

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
    const params = options.preserveQuery
      ? { returnTo: window.location.pathname + window.location.search }
      : options.includeReturn
        ? { returnTo: window.location.pathname }
        : undefined;

    const url = this.generateUrl(targetAppId, path, params);
    window.location.href = url;
  }

  openNewTab(
    targetAppId: string,
    path?: string,
    queryParams?: Record<string, string>
  ): void {
    const url = this.generateUrl(targetAppId, path, queryParams);
    window.open(url, '_blank');
  }

  getReturnLink(context: NavigationContext): string {
    return this.registry.getAppUrl(context.currentAppId, context.currentPath, {
      returnTo: encodeURIComponent(
        `${window.location.origin}${window.location.pathname}`
      ),
    });
  }
}

export const NAVIGATION_SERVICE = new InjectionToken<NavigationService>('NAVIGATION_SERVICE');
```

---

## Angular Components

### Navigation Link Component

```typescript
// File: libs/app-registry/src/lib/components/navigation-link.component.ts

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationService } from '../navigation.service';

@Component({
  selector: 'app-navigation-link',
  standalone: true,
  imports: [CommonModule],
  template: `
    <a
      [href]="url"
      [target]="openInNewTab ? '_blank' : '_self'"
      class="nav-link"
      (click)="handleClick($event)"
    >
      @if (iconName) {
        <i [class]="'icon icon-' + iconName"></i>
      }
      <span>{{ label }}</span>
    </a>
  `,
})
export class NavigationLinkComponent {
  @Input({ required: true }) targetAppId!: string;
  @Input() path?: string;
  @Input() label!: string;
  @Input() iconName?: string;
  @Input() openInNewTab = false;
  @Input() includeReturn = true;

  constructor(private readonly navigation: NavigationService) {}

  get url(): string {
    return this.navigation.generateUrl(this.targetAppId, this.path);
  }

  handleClick(event: Event): void {
    if (!this.openInNewTab) {
      event.preventDefault();
      this.navigation.navigate(this.targetAppId, this.path, {
        includeReturn: this.includeReturn,
      });
    }
  }
}
```

### Navigation Menu Component

```typescript
// File: libs/app-registry/src/lib/components/navigation-menu.component.ts

import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationService } from '../navigation.service';
import { GeneratedLink } from '../navigation.types';

@Component({
  selector: 'app-navigation-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="nav-menu" [class]="'nav-menu--' + position">
      @for (link of links; track link.url) {
        <a
          [href]="link.url"
          class="nav-menu__link"
          target="_self"
        >
          @if (link.meta.iconName) {
            <i [class]="'icon icon-' + link.meta.iconName"></i>
          }
          <span>{{ link.meta.label }}</span>
        </a>
      }
    </nav>
  `,
})
export class NavigationMenuComponent implements OnInit {
  @Input({ required: true }) appId!: string;
  @Input() position: 'primary' | 'secondary' | 'footer' = 'primary';

  links: GeneratedLink[] = [];

  constructor(private readonly navigation: NavigationService) {}

  ngOnInit(): void {
    this.links = this.getDefaultLinks();
  }

  private getDefaultLinks(): GeneratedLink[] {
    const defaults: Record<string, GeneratedLink[]> = {
      hai: [
        {
          url: '/build/new',
          target: { appId: 'system-configurator' } as any,
          meta: { label: 'Build a System', iconName: 'computer', opensNewTab: false },
        },
      ],
      'system-configurator': [
        {
          url: '/',
          target: { appId: 'hai' } as any,
          meta: { label: 'Home', opensNewTab: false },
        },
      ],
    };
    return defaults[this.appId] || [];
  }
}
```

---

## SSO and Deep Linking

### Cross-App Authentication Flow

```
hai.haidev.com (not authenticated)
        │
        ▼ Redirect to:
auth.haidev.com/login?returnTo=https%3A%2F%2Fhai.haidev.com
        │
        ▼ User authenticates
        │
        ▼ Redirect back with token:
hai.haidev.com?token=<jwt>
```

### Return Link Handling

```typescript
// File: libs/app-registry/src/lib/interceptors/return-link.interceptor.ts

import { Injectable } from '@angular/common/http';
import { HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';

@Injectable()
export class ReturnLinkInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    const returnTo = req.params.get('returnTo');
    
    if (returnTo) {
      sessionStorage.setItem('return_context', returnTo);
    }

    const cleaned = req.clone({
      params: req.params.delete('returnTo'),
    });

    return next.handle(cleaned);
  }
}
```

### Token Validation

```typescript
// File: libs/app-registry/src/lib/sso/sso.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SsoService {
  constructor(
    private readonly http: HttpClient,
    private readonly gatewayUrl: string
  ) {}

  async validateToken(token: string): Promise<TokenValidation> {
    return firstValueFrom(
      this.http.post<TokenValidation>(
        `${this.gatewayUrl}/api/auth/validate`,
        { token }
      )
    );
  }

  async exchangeToken(token: string, targetAppId: string): Promise<ExchangedToken> {
    return firstValueFrom(
      this.http.post<ExchangedToken>(
        `${this.gatewayUrl}/api/auth/exchange`,
        { token, targetAppId }
      )
    );
  }
}
```

---

## Analytics Tracking

```typescript
// File: libs/app-registry/src/lib/analytics/navigation-analytics.service.ts

import { Injectable } from '@angular/core';

@Injectable()
export class NavigationAnalyticsService {
  trackNavigation(
    sourceAppId: string,
    targetAppId: string,
    path: string
  ): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'cross_app_navigation', {
        event_category: 'navigation',
        event_label: `${sourceAppId} -> ${targetAppId}`,
        source_app: sourceAppId,
        target_app: targetAppId,
        target_path: path,
      });
    }
  }
}
```

---

## API Endpoints

### GET /api/registry/apps

Returns all registered applications.

**Response:**
```typescript
{
  success: true,
  data: {
    version: "1.0.0",
    generatedAt: "2026-04-21T00:00:00.000Z",
    apps: AppRegistration[]
  }
}
```

### GET /api/registry/apps/:appId

Returns specific application.

**Response:**
```typescript
{
  success: true,
  data: AppRegistration
}
```

### POST /api/registry/links

Create or update navigation links.

**Request:**
```typescript
{
  links: NavigationLink[]
}
```

---

## File Structure

```
libs/app-registry/
├── README.md
├── jest.config.ts
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
└── src/
    ├── index.ts
    └── lib/
        ├── app-registry.module.ts
        ├── app-registry.service.ts
        ├── app-registry.types.ts
        ├── navigation.types.ts
        ├── navigation.service.ts
        ├── default-registry.json
        ├── default-links.json
        ├── components/
        │   ├── navigation-link.component.ts
        │   └── navigation-menu.component.ts
        ├── guards/
        │   └── internal-app.guard.ts
        ├── interceptors/
        │   └── return-link.interceptor.ts
        ├── sso/
        │   └── sso.service.ts
        └── analytics/
            └── navigation-analytics.service.ts
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Create `libs/app-registry` library
- [ ] Define TypeScript interfaces
- [ ] Create default registry JSON
- [ ] Implement `AppRegistryService`
- [ ] Add Angular module

### Phase 2: Gateway Integration
- [ ] Create gateway endpoints
- [ ] Add caching layer
- [ ] Implement version-based cache busting
- [ ] Add admin endpoint for updates

### Phase 3: Navigation
- [ ] Implement `NavigationService`
- [ ] Create navigation components
- [ ] Add default links
- [ ] Implement return link handling

### Phase 4: Angular Integration
- [ ] Integrate into hai app
- [ ] Integrate into system-configurator app
- [ ] Update navigation components
- [ ] Add polling with refresh

### Phase 5: SSO Integration
- [ ] Add token validation service
- [ ] Implement token exchange
- [ ] Create auth redirect interceptor
- [ ] Add session management

### Phase 6: Admin Interface
- [ ] Create registry management UI
- [ ] Add link editor
- [ ] Add validation for domains
- [ ] Audit log for changes

---

## Testing Strategy

1. **Unit tests**: Service methods, URL generation
2. **Component tests**: Link rendering, click handling
3. **Integration tests**: Gateway endpoint
4. **E2E tests**: Cross-app navigation flows

---

## Environment Configuration

```typescript
// environment.ts
export const environment = {
  production: false,
  registryUrl: '/api/registry/apps',
  registryRefreshInterval: 300000, // 5 minutes
  defaultApps: {
    gateway: 'https://api.haidev.com',
    current: 'hai',
  },
};
```

---

## Usage Examples

### Basic Navigation Link

```html
<app-navigation-link
  targetAppId="system-configurator"
  path="/build/new"
  label="Build a System"
  iconName="computer"
/>
```

### Navigation Menu

```html
<app-navigation-menu
  appId="hai"
  position="footer"
/>
```

### Programmatic Navigation

```typescript
@Component({...})
export class OrderConfirmComponent {
  constructor(private readonly navigation: NavigationService) {}

  viewOrderStatus(orderId: string) {
    this.navigation.navigate('system-configurator', `/orders/${orderId}/status`);
  }
}
```

### Get App URL

```typescript
@Component({...})
export class NavComponent {
  constructor(private readonly registry: AppRegistryService) {}

  get storeUrl(): string {
    return this.registry.getAppUrl('store');
  }
}
```
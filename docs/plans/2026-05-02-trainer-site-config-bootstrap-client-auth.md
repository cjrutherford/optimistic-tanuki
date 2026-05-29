# Trainer Site-Config Bootstrap & Client Auth Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the site-config bootstrap (graceful 404 → default handling, create-on-first-save) and add a real client auth flow to the trainer-site (login page, `clientAuthGuard`, replace hardcoded `'client-demo'` IDs with the authenticated user's `profileId`).

**Architecture:**

- Gateway `GET /trainer/site-config` catches microservice 404/null and returns the Angular default config shape so the frontend never crashes.
- Gateway `PUT /trainer/site-config` accepts an optional `configId`; when absent it calls `AppConfigCommands.Create` instead of `Update`.
- Client auth mirrors the existing trainer auth: a `clientAuthGuard`, a `TrainerClientLoginPageComponent`, and a `clientUser` signal in `TrainerAuthService` (or a separate lightweight `ClientAuthService`). Because both owner and client share the same gateway auth endpoints the simplest approach is to extend `TrainerAuthService` with a second `loginClient()` method and a dedicated localStorage key `trainer-site:client`.

**Tech Stack:** Angular 18 (signals, `toSignal`), NestJS gateway, RxJS, `APP_CONFIGURATOR_SERVICE` TCP microservice.

---

### Task 1: Gateway — graceful fallback for `GET /trainer/site-config`

**Files:**

- Modify: `apps/gateway/src/controllers/trainer/trainer.controller.ts`

**Context:**
When no `app-config` record exists for `trainer-site` the microservice returns `null` or throws an `RpcException`. The gateway must catch this and return a sensible default JSON shape so the Angular app does not break on a fresh deployment.

**Step 1: Add try/catch + null guard to `getSiteConfig()`**

Replace the existing `getSiteConfig()` method body:

```typescript
@Get('site-config')
async getSiteConfig() {
  try {
    const result = await firstValueFrom(
      this.appConfigService.send(
        { cmd: AppConfigCommands.GetByName },
        { name: 'trainer-site' }
      )
    );
    // Microservice returns null when record not found
    if (!result) {
      return { configId: null, config: null };
    }
    return result;
  } catch {
    return { configId: null, config: null };
  }
}
```

**Step 2: Build the gateway to confirm no TypeScript errors**

```bash
pnpm nx build gateway
```

Expected: successful build, no errors.

**Step 3: Commit**

```bash
git add apps/gateway/src/controllers/trainer/trainer.controller.ts
git commit -m "fix(gateway): return null-safe default when trainer site-config not found"
```

---

### Task 2: Gateway — create-on-first-save for `PUT /trainer/site-config`

**Files:**

- Modify: `apps/gateway/src/controllers/trainer/trainer.controller.ts`

**Context:**
The Angular site-editor sends `{ configId, config }`. On first save `configId` will be `null` or absent. The gateway should detect this and call `AppConfigCommands.Create` with `{ domain: 'trainer-site', name: 'trainer-site', config }`.

**Step 1: Update the `updateSiteConfig()` method**

Replace the existing body:

```typescript
@RequirePermissions('app-config.update')
@UseGuards(AuthGuard, PermissionsGuard)
@Put('site-config')
async updateSiteConfig(
  @Body() payload: { configId?: string | null; config: Record<string, unknown> }
) {
  if (!payload.configId) {
    // First save — create the record
    return firstValueFrom(
      this.appConfigService.send(
        { cmd: AppConfigCommands.Create },
        { domain: 'trainer-site', name: 'trainer-site', config: payload.config }
      )
    );
  }
  return firstValueFrom(
    this.appConfigService.send(
      { cmd: AppConfigCommands.Update },
      { id: payload.configId, config: payload.config }
    )
  );
}
```

**Step 2: Build gateway**

```bash
pnpm nx build gateway
```

Expected: clean build.

**Step 3: Commit**

```bash
git add apps/gateway/src/controllers/trainer/trainer.controller.ts
git commit -m "feat(gateway): create trainer site-config on first save when no configId present"
```

---

### Task 3: Angular — wire `configId` through site-config flow

**Files:**

- Modify: `libs/trainer-data-access/src/lib/trainer-site.config.ts`
- Modify: `libs/trainer-data-access/src/lib/trainer-api.service.ts`
- Modify: `libs/trainer-portal-ui/src/lib/trainer-site-editor-page.component.ts`
- Modify: `apps/trainer-site/src/app/app.component.ts`

**Context:**
The gateway now returns `{ configId, config }` or `{ configId: null, config: null }`. Angular needs to:

1. Store the `configId` from the GET response.
2. Pass it back on PUT so the gateway can choose create vs update.

**Step 1: Add `configId` to the GET response interface in `trainer-api.service.ts`**

In `getOffers()` the return type is inferred; add an explicit interface for the site-config response. In `trainer-api.service.ts`, after the imports, add:

```typescript
export interface SiteConfigResponse {
  configId: string | null;
  config: TrainerSiteConfig | null;
}
```

Update `getSiteConfig()` return type:

```typescript
getSiteConfig(): Observable<SiteConfigResponse> {
  return this.http.get<SiteConfigResponse>(`${this.baseUrl}/site-config`);
}
```

Update `updateSiteConfig()` signature:

```typescript
updateSiteConfig(configId: string | null, config: TrainerSiteConfig): Observable<unknown> {
  return this.http.put(
    `${this.baseUrl}/site-config`,
    { configId, config },
    { headers: this.authHeaders() }
  );
}
```

**Step 2: Update `app.component.ts` — store `configId` signal**

Add a `configId = signal<string | null>(null)` field. In `ngOnInit` where `getSiteConfig()` is called:

```typescript
this.api.getSiteConfig().subscribe({
  next: (res) => {
    this.configId.set(res.configId ?? null);
    const merged = res.config ? { ...DEFAULT_TRAINER_SITE_CONFIG, ...res.config } : DEFAULT_TRAINER_SITE_CONFIG;
    this.site.set(merged);
  },
  error: () => this.site.set(DEFAULT_TRAINER_SITE_CONFIG),
});
```

**Step 3: Update `trainer-site-editor-page.component.ts` — pass `configId` on save**

The editor loads config via `getSiteConfig()` and saves via `updateSiteConfig()`. Store the configId locally:

```typescript
private configId: string | null = null;

ngOnInit() {
  this.api.getSiteConfig().subscribe({
    next: (res) => {
      this.configId = res.configId ?? null;
      const cfg = res.config ?? DEFAULT_TRAINER_SITE_CONFIG;
      // ...populate form fields from cfg...
    },
  });
}

save() {
  this.api.updateSiteConfig(this.configId, this.currentConfig()).subscribe({
    next: (saved: any) => {
      // After create, the response includes the new id — persist it
      if (saved?.id && !this.configId) {
        this.configId = saved.id;
      }
    },
  });
}
```

**Step 4: Build `trainer-site`**

```bash
pnpm nx build trainer-site
```

Expected: clean build.

**Step 5: Commit**

```bash
git add libs/trainer-data-access/src/lib/trainer-api.service.ts \
        libs/trainer-portal-ui/src/lib/trainer-site-editor-page.component.ts \
        apps/trainer-site/src/app/app.component.ts
git commit -m "feat(trainer-site): thread configId through site-config get/save for bootstrap"
```

---

### Task 4: `TrainerAuthService` — add client login support

**Files:**

- Modify: `libs/trainer-data-access/src/lib/trainer-auth.service.ts`

**Context:**
Client users log in with the same `/api/authentication/login` + `/api/authentication/exchange` flow as the trainer owner, but scoped to `trainer-site-client` (or just store separately under a distinct localStorage key so they don't collide). We'll reuse the same exchange endpoint with `targetAppId: 'trainer-site'` — the returned `profileId` becomes the `clientId` used throughout.

We keep a separate `_clientUser` signal and `CLIENT_USER_KEY` so owner and client sessions are independent.

**Step 1: Add client auth to `TrainerAuthService`**

Add after the existing constants:

```typescript
const CLIENT_USER_KEY = 'trainer-site:client-user';
const CLIENT_TOKEN_KEY = 'trainer-site:client-token';
```

Add to the class:

```typescript
private readonly _clientUser = signal<TrainerAuthUser | null>(this.loadClientUser());

readonly clientUser = this._clientUser.asReadonly();
readonly isClientAuthenticated = computed(() => !!this._clientUser());
readonly clientToken = computed(() => this._clientUser()?.token ?? null);

loginClient(email: string, password: string): Observable<TrainerAuthUser> {
  return new Observable<TrainerAuthUser>((observer) => {
    this.http
      .post<{ token: string; userId?: string; email?: string }>(
        '/api/authentication/login',
        { email, password }
      )
      .subscribe({
        next: (loginResult) => {
          const baseToken = loginResult?.token;
          if (!baseToken) {
            observer.error(new Error('Login did not return a token'));
            return;
          }
          this.http
            .post<{ token: string; profileId: string }>(
              '/api/authentication/exchange',
              { targetAppId: 'trainer-site' },
              { headers: { Authorization: `Bearer ${baseToken}` } }
            )
            .subscribe({
              next: (exchangeResult) => {
                const authUser: TrainerAuthUser = {
                  token: exchangeResult.token,
                  profileId: exchangeResult.profileId,
                  userId: loginResult.userId ?? '',
                  email: loginResult.email ?? email,
                };
                this.storeClientUser(authUser);
                observer.next(authUser);
                observer.complete();
              },
              error: (err) => observer.error(err),
            });
        },
        error: (err) => observer.error(err),
      });
  });
}

logoutClient(): void {
  this.clearClientUser();
}

getClientAuthHeaders(): Record<string, string> {
  const token = this.clientToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

private storeClientUser(user: TrainerAuthUser): void {
  this._clientUser.set(user);
  if (isPlatformBrowser(this.platformId)) {
    localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem(CLIENT_TOKEN_KEY, user.token);
  }
}

private clearClientUser(): void {
  this._clientUser.set(null);
  if (isPlatformBrowser(this.platformId)) {
    localStorage.removeItem(CLIENT_USER_KEY);
    localStorage.removeItem(CLIENT_TOKEN_KEY);
  }
}

private loadClientUser(): TrainerAuthUser | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CLIENT_USER_KEY);
    return raw ? (JSON.parse(raw) as TrainerAuthUser) : null;
  } catch {
    return null;
  }
}
```

**Step 2: Lint the lib**

```bash
pnpm nx lint trainer-data-access
```

Expected: no errors.

**Step 3: Commit**

```bash
git add libs/trainer-data-access/src/lib/trainer-auth.service.ts
git commit -m "feat(trainer-auth): add client login/logout signals to TrainerAuthService"
```

---

### Task 5: Create `TrainerClientLoginPageComponent`

**Files:**

- Create: `libs/trainer-portal-ui/src/lib/trainer-client-login-page.component.ts`
- Modify: `libs/trainer-portal-ui/src/index.ts`

**Step 1: Create the component**

```typescript
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TrainerAuthService } from '@optimistic-tanuki/trainer-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'trainer-client-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CardComponent],
  template: `
    <section class="center">
      <otui-card class="form-card">
        <h2>Client login</h2>
        <form class="form" (ngSubmit)="login()">
          <label>
            Email
            <input type="email" [(ngModel)]="email" name="email" autocomplete="email" />
          </label>
          <label>
            Password
            <input type="password" [(ngModel)]="password" name="password" autocomplete="current-password" />
          </label>
          @if (error()) {
          <p class="error">{{ error() }}</p>
          }
          <otui-button type="submit" variant="primary" [disabled]="loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </otui-button>
        </form>
      </otui-card>
    </section>
  `,
  styles: [
    `
      .center {
        display: flex;
        justify-content: center;
        padding: 4rem 1rem;
      }
      .form-card {
        width: 100%;
        max-width: 420px;
      }
      h2 {
        margin: 0 0 1.25rem;
        font-family: var(--font-heading, system-ui);
        font-weight: 700;
      }
      .form {
        display: grid;
        gap: 1rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.88rem;
        font-weight: 600;
      }
      input {
        font: inherit;
        padding: 0.8rem 0.9rem;
        border-radius: var(--personality-input-radius, 1rem);
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.04);
        color: inherit;
      }
      .error {
        color: var(--destructive, #e11d48);
        margin: 0;
        font-size: 0.88rem;
      }
    `,
  ],
})
export class TrainerClientLoginPageComponent {
  private readonly auth = inject(TrainerAuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  login(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.loginClient(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/client/dashboard']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Invalid email or password.');
      },
    });
  }
}
```

**Step 2: Export from `libs/trainer-portal-ui/src/index.ts`**

Add:

```typescript
export * from './lib/trainer-client-login-page.component';
```

**Step 3: Lint**

```bash
pnpm nx lint trainer-portal-ui
```

Expected: no errors.

**Step 4: Commit**

```bash
git add libs/trainer-portal-ui/src/lib/trainer-client-login-page.component.ts \
        libs/trainer-portal-ui/src/index.ts
git commit -m "feat(trainer-portal-ui): add TrainerClientLoginPageComponent"
```

---

### Task 6: Create `clientAuthGuard`

**Files:**

- Create: `apps/trainer-site/src/app/client-auth.guard.ts`

**Step 1: Create the guard**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TrainerAuthService } from '@optimistic-tanuki/trainer-data-access';

export const clientAuthGuard: CanActivateFn = () => {
  const auth = inject(TrainerAuthService);
  const router = inject(Router);
  if (auth.isClientAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/client/login']);
};
```

**Step 2: Lint**

```bash
pnpm nx lint trainer-site
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/trainer-site/src/app/client-auth.guard.ts
git commit -m "feat(trainer-site): add clientAuthGuard redirecting to /client/login"
```

---

### Task 7: Wire client routes — add login route, apply guard

**Files:**

- Modify: `apps/trainer-site/src/app/app.routes.ts`

**Context:**
Current `/client` routes have no guards and no login page. We need:

- `GET /client/login` → `TrainerClientLoginPageComponent` (unguarded)
- `/client` parent and children → `canActivate: [clientAuthGuard]`

**Step 1: Update `app.routes.ts`**

Add the login route and guard to the `/client` routes:

```typescript
// import additions at top of file:
import { TrainerClientLoginPageComponent } from '@optimistic-tanuki/trainer-portal-ui';
import { clientAuthGuard } from './client-auth.guard';

// Route changes — the /client parent route gets canActivate, login stays outside:
{
  path: 'client',
  children: [
    {
      path: 'login',
      component: TrainerClientLoginPageComponent,
    },
    {
      path: '',
      component: TrainerPortalShellComponent,
      canActivate: [clientAuthGuard],
      children: [
        { path: '', component: TrainerClientPortalHomePageComponent },
        { path: 'dashboard', component: TrainerClientDashboardPageComponent },
        { path: 'routines', component: TrainerClientRoutinesPageComponent },
        { path: 'billing', component: TrainerClientBillingPageComponent },
      ],
    },
  ],
},
```

**Step 2: Build**

```bash
pnpm nx build trainer-site
```

Expected: clean build.

**Step 3: Commit**

```bash
git add apps/trainer-site/src/app/app.routes.ts
git commit -m "feat(trainer-site): guard /client routes with clientAuthGuard, add /client/login route"
```

---

### Task 8: Replace hardcoded `'client-demo'` with authenticated `profileId`

**Files:**

- Modify: `libs/trainer-portal-ui/src/lib/trainer-client-dashboard-page.component.ts`
- Modify: `libs/trainer-portal-ui/src/lib/trainer-client-routines-page.component.ts`
- Modify: `libs/trainer-portal-ui/src/lib/trainer-client-billing-page.component.ts`

**Context:**
`TrainerAuthService.clientUser()` now provides the authenticated client's `profileId`. Replace the three hardcoded `'client-demo'` strings.

**Step 1: `trainer-client-dashboard-page.component.ts`**

```typescript
// Add inject for auth service
private readonly auth = inject(TrainerAuthService);
private readonly clientId = computed(() => this.auth.clientUser()?.profileId ?? '');

// Replace toSignal calls — use switchMap on clientId:
readonly bookings = toSignal(
  toObservable(this.clientId).pipe(
    switchMap(id => id ? this.api.getClientBookings(id) : of([]))
  ),
  { initialValue: [] }
);
readonly routines = toSignal(
  toObservable(this.clientId).pipe(
    switchMap(id => id ? this.api.getClientRoutines(id) : of([]))
  ),
  { initialValue: [] }
);
readonly checkIns = toSignal(
  toObservable(this.clientId).pipe(
    switchMap(id => id ? this.api.getClientCheckIns(id) : of([]))
  ),
  { initialValue: [] }
);
```

Add required imports: `computed` from `@angular/core`, `toObservable` from `@angular/core/rxjs-interop`, `switchMap`, `of` from `rxjs`, `TrainerAuthService` from `@optimistic-tanuki/trainer-data-access`.

**Step 2: `trainer-client-routines-page.component.ts`**

Same pattern for `routines`. Also update `submitCheckIn()` to use `this.auth.clientUser()?.profileId` instead of `'client-demo'`.

**Step 3: `trainer-client-billing-page.component.ts`**

Same pattern for `bookings`.

**Step 4: `trainer-client-portal-home-page.component.ts`**

This component only uses `DEFAULT_TRAINER_SITE_CONFIG.clientPortal` for display copy — no auth needed here. No change required.

**Step 5: Build `trainer-site`**

```bash
pnpm nx build trainer-site
```

Expected: clean build.

**Step 6: Lint**

```bash
pnpm nx lint trainer-portal-ui
```

Expected: no errors.

**Step 7: Commit**

```bash
git add libs/trainer-portal-ui/src/lib/trainer-client-dashboard-page.component.ts \
        libs/trainer-portal-ui/src/lib/trainer-client-routines-page.component.ts \
        libs/trainer-portal-ui/src/lib/trainer-client-billing-page.component.ts
git commit -m "feat(trainer-portal-ui): replace hardcoded client-demo with authenticated profileId"
```

---

### Task 9: Update `app.component.ts` topbar — client auth state

**Files:**

- Modify: `apps/trainer-site/src/app/app.component.ts`

**Context:**
The topbar currently shows a "Client Login" ghost link always pointing to `/client`. Now that we have a real client auth flow:

- If `isClientAuthenticated`: show "Client Portal" → `/client/dashboard` and a "Sign Out" (client) action.
- If not: show "Client Login" → `/client/login`.

**Step 1: Inject `TrainerAuthService` (already injected as `auth`) and expose client signals**

In `app.component.ts` add:

```typescript
readonly isClientAuthenticated = this.auth.isClientAuthenticated;
readonly clientUser = this.auth.clientUser;

signOutClient(): void {
  this.auth.logoutClient();
  this.router.navigate(['/client/login']);
}
```

**Step 2: Update the template topbar section**

Replace the static `/client` link block with:

```html
@if (isClientAuthenticated()) {
<a routerLink="/client/dashboard" class="nav-link">Client Portal</a>
<button class="btn-ghost" (click)="signOutClient()">Sign Out (Client)</button>
} @else {
<a routerLink="/client/login" class="btn-ghost">Client Login</a>
}
```

**Step 3: Build**

```bash
pnpm nx build trainer-site
```

Expected: clean build.

**Step 4: Commit**

```bash
git add apps/trainer-site/src/app/app.component.ts
git commit -m "feat(trainer-site): show client auth state in topbar, wire sign-out"
```

---

## Summary of changes

| Area                                  | What changed                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Gateway `GET /trainer/site-config`    | Returns `{ configId: null, config: null }` on 404/error instead of throwing     |
| Gateway `PUT /trainer/site-config`    | Calls `Create` when `configId` absent, `Update` otherwise                       |
| `TrainerApiService`                   | `SiteConfigResponse` type, `configId` threaded through get/save                 |
| `TrainerSiteEditorPageComponent`      | Stores `configId`, persists new id after create                                 |
| `app.component.ts`                    | Stores `configId` from GET, merges with default correctly                       |
| `TrainerAuthService`                  | `loginClient()`, `logoutClient()`, `clientUser` signal, `isClientAuthenticated` |
| NEW `TrainerClientLoginPageComponent` | Login form, navigates to `/client/dashboard` on success                         |
| NEW `clientAuthGuard`                 | Redirects unauthenticated visitors to `/client/login`                           |
| `app.routes.ts`                       | `/client/login` added, client shell children guarded                            |
| Client portal pages                   | `'client-demo'` replaced with `auth.clientUser()?.profileId`                    |
| `app.component.ts` topbar             | Conditional client auth nav                                                     |

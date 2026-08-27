# Angular Forms & Routing

Two of Angular's most powerful built-in features are its **Forms** module and its **Router**. React developers rely on third-party libraries (React Hook Form, React Router, TanStack Router), while Angular ships both out of the box with first-class TypeScript support.

## React vs Angular: Forms & Routing

| Feature      | React                                | Angular                                 |
| ------------ | ------------------------------------ | --------------------------------------- |
| Forms        | React Hook Form, Formik, or manual   | `ReactiveFormsModule` or `FormsModule`  |
| Validation   | Third-party (Zod + RHF) or manual    | Built-in validators + custom validators |
| Routing      | React Router v6 / TanStack Router    | `@angular/router` (built-in)            |
| Lazy loading | `React.lazy()` + `Suspense`          | `loadComponent()` / `loadChildren()`    |
| Route guards | Wrapper components / `loader` in RR6 | `CanActivateFn` guard functions         |
| URL params   | `useParams()`                        | `ActivatedRoute.params` / `input()`     |

---

## Reactive Forms (Recommended)

Angular's **Reactive Forms** give you explicit, type-safe form management in the component class — similar in spirit to React Hook Form's `useForm()`.

```ts
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div>
        <label for="email">Email</label>
        <input id="email" formControlName="email" type="email" />
        @if (form.controls.email.invalid && form.controls.email.touched) {
        <span class="error">Valid email is required</span>
        }
      </div>
      <div>
        <label for="password">Password</label>
        <input id="password" formControlName="password" type="password" />
        @if (form.controls.password.hasError('minlength') && form.controls.password.touched) {
        <span class="error">Minimum 8 characters</span>
        }
      </div>
      <button type="submit" [disabled]="form.invalid">Log in</button>
    </form>
  `,
})
export class LoginFormComponent {
  // FormBuilder provides a concise API for constructing forms
  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor(private fb: FormBuilder) {}

  submit(): void {
    if (this.form.invalid) return;
    const { email, password } = this.form.getRawValue();
    console.log('Login:', email, password);
  }
}
```

**React Hook Form equivalent:**

```tsx
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Minimum 8 characters'),
});

type LoginFields = z.infer<typeof schema>;

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFields>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit((data) => console.log('Login:', data))}>
      <input {...register('email')} type="email" />
      {errors.email && <span>{errors.email.message}</span>}
      <input {...register('password')} type="password" />
      {errors.password && <span>{errors.password.message}</span>}
      <button type="submit" disabled={!isValid}>
        Log in
      </button>
    </form>
  );
}
```

---

## Custom Validators

Angular's validator API is purely functional and fully typed:

```ts
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms'

// Custom validator — must return null (valid) or a ValidationErrors object
export function passwordStrength(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string
    if (!value) return null

    const hasUpperCase = /[A-Z]/.test(value)
    const hasNumber    = /\d/.test(value)

    if (!hasUpperCase || !hasNumber) {
      return {
        passwordStrength: {
          hasUpperCase,
          hasNumber,
        },
      }
    }
    return null  // ← null means valid
  }
}

// Usage
password: ['', [Validators.required, Validators.minLength(8), passwordStrength()]],
```

**React Hook Form + Zod equivalent:**

```ts
const schema = z.object({
  password: z
    .string()
    .min(8)
    .refine((v) => /[A-Z]/.test(v), { message: 'Must contain an uppercase letter' })
    .refine((v) => /\d/.test(v), { message: 'Must contain a number' }),
});
```

---

## Template-Driven Forms (Simple Use Cases)

For simple forms, `FormsModule` with `[(ngModel)]` is quicker — analogous to using controlled inputs in React:

```ts
@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <input [(ngModel)]="name" placeholder="Your name" />
    <p>Hello, {{ name }}</p>
  `,
})
export class SimpleFormComponent {
  name = '';
}
```

**React equivalent:**

```tsx
function SimpleForm() {
  const [name, setName] = useState('');
  return (
    <>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      <p>Hello, {name}</p>
    </>
  );
}
```

> **When to use each:**
>
> - **Template-driven** — simple, minimal-logic forms with few fields
> - **Reactive forms** — complex validation, dynamic fields, cross-field validation, testing

---

## Angular Router

### Basic Setup

```ts
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  // Lazy-loaded feature module
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  // Route with params
  { path: 'users/:id', component: UserDetailComponent },
  // Wildcard
  { path: '**', redirectTo: '' },
];
```

**React Router v6 equivalent:**

```tsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/login" element={<Login />} />
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    }
  />
  <Route path="/users/:id" element={<UserDetail />} />
  <Route path="*" element={<Navigate to="/" />} />
</Routes>
```

### Route Guards

```ts
// guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  // Redirect to login, return the UrlTree
  return router.parseUrl('/login');
};
```

**React Router v6 equivalent (wrapper component):**

```tsx
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}
```

### Reading Route Parameters

```ts
// Angular 17+ — route params as signals via input()
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  template: `<p>User ID: {{ id() }}</p>`,
})
export class UserDetailComponent {
  readonly id = input.required<string>(); // ← wired to :id route param automatically
}
```

```tsx
// React Router
function UserDetail() {
  const { id } = useParams<{ id: string }>();
  return <p>User ID: {id}</p>;
}
```

---

## ⚠️ Anti-Patterns to Avoid

### 1. Using template-driven forms for complex validation

```ts
// ❌ Template-driven forms become unmanageable with complex validation
<input [(ngModel)]="email" required email #emailRef="ngModel">
<input [(ngModel)]="password" required minlength="8" #passRef="ngModel">
<!-- Validation logic scattered across the template — hard to test -->

// ✅ Use Reactive Forms for anything beyond 2–3 fields
form = this.fb.nonNullable.group({
  email:    ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(8)]],
})
```

### 2. Accessing `FormControl.value` when the form could be null

```ts
// ❌ Dangerous — value is typed as T | null when form group could be pristine
const email = this.form.value.email; // string | null | undefined

// ✅ Use getRawValue() with nonNullable form builder
const email = this.form.getRawValue().email; // string — safe
```

### 3. Wildcard-first route ordering

```ts
// ❌ Wildcard first — every route matches '**' and redirects immediately
const routes: Routes = [
  { path: '**', redirectTo: '' }, // ← matches everything!
  { path: '', component: HomeComponent },
];

// ✅ Wildcard always last
const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: '**', redirectTo: '' }, // ← catches only unmatched paths
];
```

### 4. Eager-loading everything

```ts
// ❌ All components bundled into the initial JS payload
{ path: 'admin',   component: AdminComponent },     // ← loaded even for non-admin users
{ path: 'reports', component: ReportsComponent },

// ✅ Lazy-load heavy features
{ path: 'admin',   loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent) },
{ path: 'reports', loadComponent: () => import('./reports/reports.component').then(m => m.ReportsComponent) },
```

### 5. Two-way binding on large objects

```ts
// ❌ Hard to trace which property changed, hurts OnPush
<app-form [(user)]="user" />

// ✅ Use explicit @Input() and @Output() events
<app-form [user]="user" (userChange)="updateUser($event)" />
```

---

## ✅ Best Practices

1. **Always use Reactive Forms in production apps** — they are testable, type-safe, and explicit
2. **Mark forms as `nonNullable`** using `FormBuilder.nonNullable` to avoid `string | null` in your types
3. **Lazy-load every route** except the landing page to keep initial bundle small
4. **Use functional guards** (`CanActivateFn`) — they are simpler than class-based guards and support `inject()`
5. **Enable `withComponentInputBinding()`** in your router config to bind route params directly to `@Input()` / `input()`
6. **Validate on `blur` by default** — use `updateOn: 'blur'` on controls to avoid noisy validation on every keystroke

```ts
// router config with input binding
import { provideRouter, withComponentInputBinding } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withComponentInputBinding())],
};
```

```ts
// 'blur' validation strategy
form = this.fb.nonNullable.group({ email: ['', Validators.required] }, { updateOn: 'blur' });
```

---

## Summary

Angular's Reactive Forms and Router work together to give you type-safe, feature-rich SPAs without third-party dependencies. The patterns map closely to what React developers know from React Hook Form and React Router — but with tighter TypeScript integration and a consistent, opinionated API. Master these two features and you have everything you need to build production Angular applications.

# Angular Services & Dependency Injection

Angular ships a powerful built-in **Dependency Injection (DI)** container. Where React developers reach for Context or external state libraries (Zustand, Redux), Angular developers define **services** — injectable classes that encapsulate shared logic and state.

## React vs Angular: Shared Logic

| Pattern               | React                                  | Angular                               |
| --------------------- | -------------------------------------- | ------------------------------------- |
| Shared state          | Context + `useReducer`, Zustand, Redux | Injectable `Service` class            |
| API calls             | Custom hook (`useFetch`)               | Injectable `HttpClient`-based service |
| Cross-component comms | Lift state up / context                | Service with `Subject` / Signal       |
| Singleton services    | Module-level variable / React Query    | `providedIn: 'root'` service          |

---

## Your First Service

```ts
// user.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable({ providedIn: 'root' }) // ← singleton across the whole app
export class UserService {
  private readonly users = signal<User[]>([]);

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/users');
  }

  loadUsers(): void {
    this.http.get<User[]>('/api/users').subscribe((users) => {
      this.users.set(users);
    });
  }

  users$ = this.users.asReadonly(); // expose read-only signal
}
```

**React equivalent (custom hook + React Query):**

```tsx
// Typically done with React Query or SWR
function useUsers() {
  return useQuery<User[]>({ queryKey: ['users'], queryFn: () => fetch('/api/users').then((r) => r.json()) });
}
```

---

## Dependency Injection in Components

```ts
import { Component, OnInit } from '@angular/core';
import { UserService, User } from './user.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    @if (loading()) {
    <p>Loading...</p>
    } @else { @for (user of users(); track user.id) {
    <div>{{ user.name }} — {{ user.email }}</div>
    } }
  `,
})
export class UserListComponent implements OnInit {
  protected users = this.userService.users$;
  protected loading = signal(true);

  // Angular automatically provides UserService via constructor injection
  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.userService.loadUsers();
    this.loading.set(false);
  }
}
```

**React equivalent:**

```tsx
function UserList() {
  const { data: users, isLoading } = useUsers();
  if (isLoading) return <p>Loading...</p>;
  return (
    <div>
      {users?.map((u) => (
        <div key={u.id}>
          {u.name} — {u.email}
        </div>
      ))}
    </div>
  );
}
```

---

## RxJS — Angular's Async Foundation

Angular is deeply integrated with **RxJS Observables**. Where React uses Promises and `async/await`, Angular services typically expose `Observable` streams.

```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private cache$: Observable<Product[]> | null = null;

  constructor(private http: HttpClient) {}

  // Observable with error handling and caching
  getProducts(): Observable<Product[]> {
    if (!this.cache$) {
      this.cache$ = this.http.get<Product[]>('/api/products').pipe(
        map((products) => products.filter((p) => p.active)),
        catchError(() => of([])), // return empty array on error
        shareReplay(1) // cache the last value
      );
    }
    return this.cache$;
  }
}
```

**React equivalent (React Query + Zod for runtime safety):**

```tsx
import { z } from 'zod';

const ProductSchema = z.object({ id: z.number(), name: z.string(), active: z.boolean() });
type Product = z.infer<typeof ProductSchema>;

function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const raw = await fetch('/api/products').then((r) => r.json());
      const products = z.array(ProductSchema).parse(raw); // runtime-validated
      return products.filter((p) => p.active);
    },
  });
}
```

### Essential RxJS Operators

| Operator             | Purpose                            | React equivalent                     |
| -------------------- | ---------------------------------- | ------------------------------------ |
| `map`                | Transform values                   | Array `.map()`                       |
| `filter`             | Filter values                      | Array `.filter()`                    |
| `switchMap`          | Cancel previous inner observable   | AbortController pattern              |
| `mergeMap`           | Run inner observables concurrently | `Promise.all`                        |
| `catchError`         | Handle errors                      | `try/catch`                          |
| `shareReplay(1)`     | Cache and share last value         | React Query's stale-while-revalidate |
| `debounceTime`       | Debounce rapid emissions           | `lodash.debounce`                    |
| `takeUntilDestroyed` | Auto-unsubscribe on destroy        | `useEffect` cleanup                  |

---

## Store Pattern with Signals

Angular 17+ Signals enable a lightweight Redux-like store without extra libraries:

```ts
// counter.store.ts
import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CounterStore {
  // Private writable state
  private readonly _count = signal(0);

  // Public read-only state
  readonly count = this._count.asReadonly();
  readonly double = computed(() => this._count() * 2);

  increment(): void {
    this._count.update((n) => n + 1);
  }
  decrement(): void {
    this._count.update((n) => n - 1);
  }
  reset(): void {
    this._count.set(0);
  }
}
```

**React equivalent (Zustand):**

```ts
import { create } from 'zustand';
interface CounterStore {
  count: number;
  double: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}
const useCounterStore = create<CounterStore>((set, get) => ({
  count: 0,
  get double() {
    return get().count * 2;
  },
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: s.count - 1 })),
  reset: () => set({ count: 0 }),
}));
```

---

## ⚠️ Anti-Patterns to Avoid

### 1. Putting business logic in components

```ts
// ❌ Fat component — hard to test, hard to reuse
@Component({ selector: 'app-orders' })
export class OrdersComponent {
  orders: Order[] = [];

  loadOrders() {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => {
        this.orders = data.filter((o: Order) => o.status === 'active');
      });
  }
}

// ✅ Thin component — delegates to service
@Component({ selector: 'app-orders' })
export class OrdersComponent {
  orders$ = this.orderService.activeOrders$;

  constructor(private orderService: OrderService) {}
}
```

### 2. Not typing HttpClient responses

```ts
// ❌ Untyped — loses all benefits
this.http.get('/api/users').subscribe((data) => {
  this.users = data as any;
});

// ✅ Typed generic parameter
this.http.get<User[]>('/api/users').subscribe((users) => {
  this.users = users; // User[] — fully typed
});
```

### 3. Nesting `.subscribe()` calls

```ts
// ❌ "Callback hell" with Observables
this.userService.getUser(id).subscribe((user) => {
  this.orderService.getOrders(user.id).subscribe((orders) => {
    this.productService.getProducts().subscribe((products) => {
      // deeply nested...
    });
  });
});

// ✅ Flatten with switchMap/forkJoin
import { switchMap, forkJoin } from 'rxjs';

this.userService
  .getUser(id)
  .pipe(
    switchMap((user) =>
      forkJoin({
        orders: this.orderService.getOrders(user.id),
        products: this.productService.getProducts(),
      })
    )
  )
  .subscribe(({ orders, products }) => {
    // flat, readable
  });
```

### 4. Forgetting to unsubscribe

```ts
// ❌ Memory leak
export class MyComponent implements OnInit {
  private sub?: Subscription;

  ngOnInit() {
    this.sub = this.service.data$.subscribe((d) => (this.data = d));
    // If ngOnDestroy is missing, this subscription never ends
  }
}

// ✅ Angular 16+ built-in cleanup — takeUntilDestroyed() calls inject(DestroyRef) internally
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export class MyComponent {
  constructor() {
    this.service.data$.pipe(takeUntilDestroyed()).subscribe((d) => (this.data = d));
  }
}
```

---

## ✅ Best Practices

1. **One service per domain** — `UserService`, `OrderService`, `ProductService`; avoid god services
2. **Keep services stateless when possible**; use Signals or BehaviorSubjects only when cross-component state is genuinely needed
3. **Always type HttpClient generics** — `http.get<User[]>('/api/users')`
4. **Prefer `async` pipe in templates** over manual `.subscribe()` — it auto-unsubscribes
5. **Use `inject()` function** over constructor injection for cleaner code (Angular 14+)
6. **`providedIn: 'root'`** gives you a singleton across the app — use `providedIn: 'any'` only when you need fresh instances per lazy-loaded module

```ts
// Modern Angular 17+ style with inject()
@Component({ ... })
export class UserListComponent {
  private userService = inject(UserService)    // ← cleaner than constructor injection
  protected users     = this.userService.users$
}
```

---

## Summary

Angular's DI system makes shared logic easy to test and reuse. Services are the Angular equivalent of custom hooks and context — but they are class-based, automatically singletons, and directly injectable into any component in the app. Mastering RxJS operators and the `async` pipe is essential for productive Angular development.

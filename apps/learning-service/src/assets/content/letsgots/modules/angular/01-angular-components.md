# Angular Components with TypeScript

Angular is a full-featured, opinionated framework from Google. Unlike React's library model, Angular ships everything you need — components, routing, forms, HTTP, and dependency injection — in one cohesive package. TypeScript is not optional in Angular; it is the _only_ supported language.

## React vs Angular: Mental Model

| Concept           | React                                    | Angular                                         |
| ----------------- | ---------------------------------------- | ----------------------------------------------- |
| UI building block | Function component (`function Foo() {}`) | Class decorated with `@Component`               |
| Markup            | JSX (JavaScript + HTML)                  | HTML templates (separate files or inline)       |
| Data binding      | One-way via props & state                | Two-way with `[(ngModel)]` or explicit bindings |
| Styling           | CSS-in-JS / CSS modules / Tailwind       | Component-scoped CSS (Shadow DOM emulation)     |
| State             | `useState`, `useReducer`, Zustand…       | Component properties + Signals (Angular 17+)    |
| Built-in DI       | ❌ Use context / external lib            | ✅ Built-in hierarchical injector               |

---

## Your First Angular Component

```ts
// button.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-button',
  standalone: true, // ← Angular 17+ preferred style
  template: `
    <button [class]="'btn btn-' + variant" [disabled]="disabled" (click)="clicked.emit()">
      {{ label }}
    </button>
  `,
})
export class ButtonComponent {
  @Input() label = '';
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'primary';
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<void>();
}
```

**React equivalent:**

```tsx
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}

function Button({ label, variant = 'primary', disabled = false, onClick }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
```

**Key differences:**

- Angular uses _classes_ + decorators; React uses _functions_
- Angular has explicit `@Input()` / `@Output()` decorators; React passes everything through props
- Angular templates use `(event)` for event binding and `[property]` for property binding
- `{{ expression }}` (interpolation) in Angular ≈ `{expression}` in JSX

---

## Content Projection vs Children

React passes children via the `children` prop:

```tsx
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// Usage
<Card title="Hello">
  <p>Some content</p>
</Card>;
```

Angular uses `<ng-content>` (slot-based projection):

```ts
@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <div class="card">
      <h2>{{ title }}</h2>
      <ng-content />
    </div>
  `,
})
export class CardComponent {
  @Input() title = '';
}
```

```html
<!-- Usage -->
<app-card title="Hello">
  <p>Some content</p>
</app-card>
```

Named slots with `select`:

```ts
template: `
  <header><ng-content select="[slot=header]" /></header>
  <main><ng-content /></main>
  <footer><ng-content select="[slot=footer]" /></footer>
`;
```

---

## Component Lifecycle

Angular lifecycle hooks map closely to React's `useEffect`:

| React                                          | Angular                |
| ---------------------------------------------- | ---------------------- |
| Mount: `useEffect(() => {}, [])`               | `ngOnInit()`           |
| Update: `useEffect(() => {})`                  | `ngOnChanges(changes)` |
| Unmount: `useEffect(() => { return cleanup })` | `ngOnDestroy()`        |
| After DOM: `useLayoutEffect`                   | `ngAfterViewInit()`    |

```ts
import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

@Component({ selector: 'app-user', standalone: true, template: `<p>{{ user?.name }}</p>` })
export class UserComponent implements OnInit, OnChanges, OnDestroy {
  @Input() userId!: string;
  user: { name: string } | null = null;

  ngOnInit(): void {
    // Runs once after first render — like useEffect(fn, [])
    this.loadUser();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Runs whenever an @Input changes — like useEffect(fn, [dep])
    if (changes['userId'] && !changes['userId'].firstChange) {
      this.loadUser();
    }
  }

  ngOnDestroy(): void {
    // Cleanup — like the return value of useEffect
    console.log('Component destroyed');
  }

  private loadUser(): void {
    // Fetch user by this.userId...
  }
}
```

---

## Change Detection

Angular uses **Zone.js** by default to detect when anything changes and re-render. This is different from React's explicit state updates.

```ts
// Every async operation (setTimeout, HTTP, events) triggers Angular's change detection.
// You rarely have to think about it — but it can cause performance issues in large apps.
```

**OnPush** strategy (recommended for performance):

```ts
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-pure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // ← Only re-render on input changes
  template: `<p>{{ value }}</p>`,
})
export class PureComponent {
  @Input() value = '';
}
```

`ChangeDetectionStrategy.OnPush` is Angular's equivalent of `React.memo` — it prevents unnecessary re-renders.

---

## Angular Signals (Angular 17+)

Angular 17 introduced **Signals** as a fine-grained reactivity system — much closer to React's `useState`:

```ts
import { Component, signal, computed } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  template: `
    <p>Count: {{ count() }}</p>
    <p>Double: {{ double() }}</p>
    <button (click)="increment()">+</button>
  `,
})
export class CounterComponent {
  count = signal(0);
  double = computed(() => this.count() * 2); // like useMemo

  increment(): void {
    this.count.update((n) => n + 1); // like setState(n => n + 1)
  }
}
```

**React equivalent:**

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  const double = useMemo(() => count * 2, [count]);
  return (
    <>
      <p>Count: {count}</p>
      <p>Double: {double}</p>
      <button onClick={() => setCount((n) => n + 1)}>+</button>
    </>
  );
}
```

---

## ⚠️ Anti-Patterns to Avoid

### 1. Mutating `@Input()` properties

```ts
// ❌ Never mutate an @Input directly
export class ItemComponent {
  @Input() items: string[] = [];

  addItem(item: string) {
    this.items.push(item); // ❌ mutates the parent's reference
  }
}

// ✅ Emit an event and let the parent update
export class ItemComponent {
  @Input() items: string[] = [];
  @Output() itemAdded = new EventEmitter<string>();

  addItem(item: string) {
    this.itemAdded.emit(item); // ✅ parent decides what to do
  }
}
```

### 2. Subscribing inside a template loop

```html
<!-- ❌ Creates a new subscription on every change detection cycle -->
<li *ngFor="let id of ids">{{ getUser(id) | async }}</li>

<!-- ✅ Resolve the data in the component class, pass it as @Input -->
<li *ngFor="let user of users$ | async">{{ user.name }}</li>
```

### 3. Using `any` to avoid TypeScript strictness

```ts
// ❌ Defeats the purpose of TypeScript
@Component({ template: `{{ data.name }}` })
export class MyComponent {
  data: any = {};
}

// ✅ Type your data
interface User {
  name: string;
  email: string;
}
@Component({ template: `{{ user?.name }}` })
export class MyComponent {
  user: User | null = null;
}
```

### 4. Not unsubscribing from Observables

```ts
// ❌ Memory leak — subscription lives forever
export class MyComponent implements OnInit {
  ngOnInit() {
    this.dataService.data$.subscribe((data) => (this.data = data));
  }
}

// ✅ Use takeUntilDestroyed (Angular 16+)
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export class MyComponent {
  constructor(private dataService: DataService) {
    this.dataService.data$.pipe(takeUntilDestroyed()).subscribe((data) => (this.data = data));
  }
}
```

---

## ✅ Best Practices

1. **Use standalone components** (Angular 15+) — avoids `NgModule` boilerplate
2. **Enable `OnPush` change detection** for performance-critical components
3. **Use Signals** for local state instead of class properties + manual change detection
4. **Type all `@Input()` properties** — use `required: true` for mandatory inputs (Angular 16+)
5. **Prefer `output()` and `input()` functions** over decorators in Angular 17+ for better type inference

```ts
// Angular 17+ functional-style inputs/outputs (cleaner, better TS integration)
import { Component, input, output } from '@angular/core';

@Component({ selector: 'app-button', standalone: true, template: `...` })
export class ButtonComponent {
  label = input.required<string>(); // required input
  variant = input<'primary' | 'danger'>('primary'); // with default
  clicked = output<void>();
}
```

---

## Summary

Angular components are class-based and use decorators to declare their metadata. While more verbose than React function components, they follow a predictable structure that scales well in large enterprise applications. Angular's built-in TypeScript support means your component contracts (inputs/outputs) are always strongly typed.

# Type Inference

One of TypeScript's best features is that you don't always have to write types — TypeScript figures them out automatically. Understanding inference helps you write cleaner, less verbose code.

## How Inference Works

TypeScript infers types from:

- **Initializers**: The value you assign to a variable
- **Return statements**: What your function returns
- **Default parameters**: The type of default values
- **Contextual typing**: The expected type from surrounding code

```typescript
// All types are inferred — no annotations needed!
const name = 'Alice'; // string
const age = 30; // number
const active = true; // boolean
const scores = [1, 2, 3]; // number[]
const pair = ['hello', 42]; // (string | number)[]
```

## Function Return Type Inference

```typescript
// TypeScript infers the return type as number
function add(a: number, b: number) {
  return a + b;
}

// Inferred as string
function getName(user: { name: string }) {
  return user.name;
}

// Inferred as number | string (union)
function getIdOrName(useId: boolean) {
  if (useId) return 42;
  return 'Alice';
}
```

## Contextual Typing

TypeScript uses the context to infer types:

```typescript
// TypeScript knows the event is MouseEvent from context
document.addEventListener('click', (event) => {
  console.log(event.clientX); // inferred, no annotation needed
});

// Array method callbacks are contextually typed
const numbers = [1, 2, 3];
const doubled = numbers.map((n) => n * 2); // n is inferred as number
```

## Widening vs. Narrowing

```typescript
// const → literal type (narrow)
const status = 'active'; // type: "active"

// let → general type (wide)
let status2 = 'active'; // type: string

// Force a literal type with 'as const':
const config = {
  endpoint: '/api',
  retries: 3,
} as const;
// type: { readonly endpoint: "/api"; readonly retries: 3 }
```

## When to Add Explicit Types

**Add explicit types when:**

- Function parameters (TypeScript can't infer from call sites)
- Variables with no initial value
- Complex return types you want to enforce
- Public API boundaries

```typescript
// Good: explicit parameter types
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Good: explicit type for uninitialized variable
let user: User | null = null;

// Overkill: TypeScript already knows this is string
const message: string = 'Hello'; // redundant annotation
```

## Type Widening Pitfalls

```typescript
// This is string[], not ["red", "green", "blue"]:
const colors = ['red', 'green', 'blue'];

// Use 'as const' if you need the literal tuple:
const colorTuple = ['red', 'green', 'blue'] as const;
// type: readonly ["red", "green", "blue"]
```

## Inference with Generics

```typescript
function wrap<T>(value: T): { value: T } {
  return { value };
}

// T is inferred as string — no need to write wrap<string>
const wrapped = wrap('hello');
// type: { value: string }
```

## Best Practices

1. **Trust inference** for local variables and obvious return types
2. **Be explicit** for function parameters and public APIs
3. **Use `as const`** for objects/arrays used as literal types
4. **Avoid redundant annotations** — they create maintenance burden
5. **Use explicit return types on exported functions** for better API documentation

## Summary

TypeScript's inference engine is powerful. Embrace it to write clean, annotation-light code while still getting full type safety. In the next lesson, we'll look at patterns for migrating larger codebases.

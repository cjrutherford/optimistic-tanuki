# Control Flow and Type Narrowing

One of TypeScript's most powerful features is **type narrowing** — the ability to refine a broad type into a more specific type based on runtime checks. TypeScript analyzes your control flow to track exactly what type a variable could be at every point.

## Basic Conditionals

```typescript
function describe(value: string | number): string {
  if (typeof value === 'string') {
    // TypeScript knows: value is string here
    return `String of length ${value.length}`;
  } else {
    // TypeScript knows: value is number here
    return `Number: ${value.toFixed(2)}`;
  }
}
```

## Type Guards

### `typeof` Guard

```typescript
function process(input: string | number | boolean) {
  if (typeof input === 'string') {
    console.log(input.toUpperCase()); // string methods available
  } else if (typeof input === 'number') {
    console.log(input.toFixed(2)); // number methods available
  } else {
    console.log(input ? 'Yes' : 'No'); // boolean operations available
  }
}
```

### `instanceof` Guard

```typescript
class Dog {
  bark() {
    return 'Woof!';
  }
}
class Cat {
  meow() {
    return 'Meow!';
  }
}

function makeSound(animal: Dog | Cat): string {
  if (animal instanceof Dog) {
    return animal.bark(); // TypeScript knows it's Dog
  }
  return animal.meow(); // TypeScript knows it's Cat
}
```

### `in` Guard

```typescript
interface Fish {
  swim(): void;
}
interface Bird {
  fly(): void;
}

function move(animal: Fish | Bird) {
  if ('swim' in animal) {
    animal.swim(); // TypeScript knows it's Fish
  } else {
    animal.fly(); // TypeScript knows it's Bird
  }
}
```

### Custom Type Guards

```typescript
interface User {
  name: string;
  role: 'user';
}
interface Admin {
  name: string;
  role: 'admin';
  permissions: string[];
}

function isAdmin(account: User | Admin): account is Admin {
  return account.role === 'admin';
}

function showPermissions(account: User | Admin) {
  if (isAdmin(account)) {
    console.log(account.permissions); // TypeScript knows it's Admin
  }
}
```

## Discriminated Unions

The most powerful pattern for type narrowing uses a shared "discriminant" property:

```typescript
type Shape = { kind: 'circle'; radius: number } | { kind: 'rectangle'; width: number; height: number } | { kind: 'triangle'; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rectangle':
      return shape.width * shape.height;
    case 'triangle':
      return (shape.base * shape.height) / 2;
  }
}
```

## Exhaustiveness Checking

TypeScript can enforce that you've handled all cases:

```typescript
function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

function describe(shape: Shape): string {
  switch (shape.kind) {
    case 'circle':
      return `Circle r=${shape.radius}`;
    case 'rectangle':
      return `Rect ${shape.width}x${shape.height}`;
    case 'triangle':
      return `Triangle b=${shape.base} h=${shape.height}`;
    default:
      return assertNever(shape); // ❌ Error if you miss a case
  }
}
```

## Nullish Checks

```typescript
function greet(name: string | null | undefined): string {
  if (name == null) {
    // catches both null and undefined
    return 'Hello, stranger!';
  }
  return `Hello, ${name}!`;
}

// Optional chaining
const length = name?.length; // undefined if name is null/undefined

// Nullish coalescing
const displayName = name ?? 'Anonymous';
```

## Loops with Types

```typescript
const numbers: number[] = [1, 2, 3, 4, 5];

// for...of
for (const n of numbers) {
  console.log(n * 2);
}

// forEach
numbers.forEach((n, index) => {
  console.log(`${index}: ${n}`);
});

// Typed entries
const map = new Map<string, number>([
  ['a', 1],
  ['b', 2],
]);
for (const [key, value] of map) {
  console.log(`${key} = ${value}`);
}
```

## Best Practices

1. **Use discriminated unions** instead of `any` for variant types
2. **Add exhaustiveness checks** with `assertNever` for switch statements
3. **Prefer `??`** over `||` for nullish defaults (avoids falsy pitfalls)
4. **Use `?.`** for safe property access on possibly-null values
5. **Write custom type guards** (`x is T`) for complex narrowing logic

## Summary

Type narrowing turns TypeScript from a type checker into a proof system — it _proves_ that your code handles every case. Next, we'll look at modules and imports.

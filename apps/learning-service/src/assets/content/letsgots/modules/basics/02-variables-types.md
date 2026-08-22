# Variables and Types

TypeScript's type system is the foundation of everything you'll do. This lesson covers how to declare variables with types, the built-in primitive types, and how TypeScript's powerful type inference works.

## Primitive Types

TypeScript has the same primitive types as JavaScript, but you can now annotate them explicitly:

```typescript
// String
const name: string = 'Alice';
const greeting: string = `Hello, ${name}!`;

// Number (integers and floats share the same type)
const age: number = 30;
const price: number = 9.99;

// Boolean
const isActive: boolean = true;
const isDeleted: boolean = false;

// Undefined and null
const nothing: undefined = undefined;
const empty: null = null;
```

## Type Inference

You don't always need to write the type explicitly. TypeScript can **infer** the type from the value:

```typescript
const message = 'Hello'; // TypeScript infers: string
const count = 42; // TypeScript infers: number
const flag = true; // TypeScript infers: boolean
```

Best practice: let TypeScript infer types for simple values, and be explicit for function signatures and complex types.

## Arrays

```typescript
// Two equivalent ways to declare a number array:
const scores: number[] = [95, 87, 72];
const names: Array<string> = ['Alice', 'Bob', 'Charlie'];

// Read-only array (cannot be modified)
const constants: readonly number[] = [1, 2, 3];
```

## Tuples

Tuples are fixed-length arrays where each position has a specific type:

```typescript
// A pair: [name, age]
const person: [string, number] = ['Alice', 30];

// Destructure it:
const [personName, personAge] = person;
console.log(personName); // "Alice"
console.log(personAge); // 30
```

## Enums

Enums let you define a set of named constants:

```typescript
enum Direction {
  Up = 'UP',
  Down = 'DOWN',
  Left = 'LEFT',
  Right = 'RIGHT',
}

const move: Direction = Direction.Up;
console.log(move); // "UP"
```

## The `any` Type (Use Sparingly!)

`any` opts out of type checking. Avoid it when possible:

```typescript
let value: any = 'hello';
value = 42; // ✅ No error (but you lose type safety)
value = true; // ✅ Still no error
value.foo.bar; // ✅ No compile error... but might crash at runtime!
```

Use `unknown` instead for safer "could be anything" scenarios:

```typescript
function process(input: unknown) {
  if (typeof input === 'string') {
    console.log(input.toUpperCase()); // Safe!
  }
}
```

## The `never` Type

`never` represents values that should never occur:

```typescript
function throwError(message: string): never {
  throw new Error(message);
}

function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}
```

## Type Aliases

Create reusable types with `type`:

```typescript
type UserId = string;
type Score = number;
type Pair = [string, number];

const id: UserId = 'abc-123';
const score: Score = 95;
```

## `const` vs `let` Type Widening

```typescript
const narrowed = 'hello'; // type: "hello" (literal type)
let widened = 'hello'; // type: string (widened)
```

When you use `const`, TypeScript infers the most specific type (literal). When you use `let`, it widens to the general type because the value might change.

## Intersection with JavaScript

TypeScript's types map directly to JavaScript's `typeof` values:

| TypeScript Type | JavaScript `typeof` |
| --------------- | ------------------- |
| `string`        | `"string"`          |
| `number`        | `"number"`          |
| `boolean`       | `"boolean"`         |
| `undefined`     | `"undefined"`       |
| `null`          | `"object"` ⚠️       |
| `symbol`        | `"symbol"`          |
| `bigint`        | `"bigint"`          |

## Best Practices

1. **Prefer `const`** over `let` when values don't change
2. **Let TypeScript infer** simple types — don't annotate unnecessarily
3. **Avoid `any`** — use `unknown` + type guards instead
4. **Use enums** for sets of related constants
5. **Be explicit** in function signatures for clarity

## Summary

You now understand TypeScript's type system building blocks. Next, we'll look at how to type functions — the workhorses of any TypeScript application.

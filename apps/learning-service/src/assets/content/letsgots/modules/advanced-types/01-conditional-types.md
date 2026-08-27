# Conditional Types

Conditional types let you define types that depend on other types — like ternary operators, but for the type system. They're a key building block of TypeScript's advanced utility types.

## Basic Syntax

```typescript
type IsString<T> = T extends string ? 'yes' : 'no';

type A = IsString<string>; // "yes"
type B = IsString<number>; // "no"
type C = IsString<'hello'>; // "yes" — "hello" extends string
```

## Practical Conditional Types

```typescript
// Extract the element type from an array
type ElementType<T> = T extends (infer U)[] ? U : never;

type Nums = ElementType<number[]>; // number
type Strs = ElementType<string[]>; // string
type None = ElementType<number>; // never

// Unwrap a Promise
type Awaited<T> = T extends Promise<infer U> ? U : T;

type Resolved = Awaited<Promise<string>>; // string
type Plain = Awaited<number>; // number
```

## The `infer` Keyword

`infer` lets you capture a type within a conditional type:

```typescript
// Get the return type of a function
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type FnReturn = ReturnType<() => string>; // string
type AsyncReturn = ReturnType<() => Promise<number>>; // Promise<number>

// Get parameter types
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

type Params = Parameters<(a: string, b: number) => void>; // [string, number]
```

## Distributive Conditional Types

When the checked type is a naked type parameter, conditional types **distribute** over unions:

```typescript
type ToArray<T> = T extends any ? T[] : never;

type Distributed = ToArray<string | number>;
// string[] | number[]  — distributed!

// Without distribution (wrap in tuple):
type NonDistributed<T> = [T] extends [any] ? T[] : never;
type Single = NonDistributed<string | number>;
// (string | number)[]
```

## Filter Types

Conditional types enable filtering unions:

```typescript
type Filter<T, U> = T extends U ? T : never;

type OnlyStrings = Filter<string | number | boolean, string>; // string
type OnlyFunctions<T> = Filter<T, (...args: any[]) => any>;
```

## Conditional Types with Mapped Types

```typescript
type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

interface User {
  id: string;
  name: string;
  greet(): void;
  update(): Promise<void>;
}

type UserMethods = FunctionPropertyNames<User>;
// "greet" | "update"
```

## Built-in Conditional Utility Types

TypeScript ships several utility types built on conditional types:

```typescript
// Extract types assignable to U from T
type Extract<T, U> = T extends U ? T : never;

// Exclude types assignable to U from T
type Exclude<T, U> = T extends U ? never : T;

// Get the return type of a function
type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;

// Get the instance type of a constructor
type InstanceType<T extends new (...args: any) => any> = T extends new (...args: any) => infer R ? R : any;
```

## Best Practices

1. **Start simple** — most use cases don't need conditional types
2. **Use `infer` for unwrapping** — great for Promise, Array, function types
3. **Beware of distribution** — it's powerful but surprising
4. **Document complex types** — conditional types can be hard to read
5. **Prefer built-in utility types** when they fit

## Summary

Conditional types complete TypeScript's type-level programming capabilities. Combined with `infer`, they let you inspect and transform type relationships in powerful ways.

# Functions in TypeScript

Functions are where TypeScript's type system really shines. By annotating parameters and return types, you make your code self-documenting and catch an entire category of bugs before they happen.

## Basic Function Syntax

```typescript
// Named function with parameter and return type annotations
function add(a: number, b: number): number {
  return a + b;
}

// Arrow function
const multiply = (a: number, b: number): number => a * b;

// Inferred return type (TypeScript figures it out)
const subtract = (a: number, b: number) => a - b;
```

## Void and Never

```typescript
// void: function returns nothing
function logMessage(msg: string): void {
  console.log(msg);
}

// never: function never returns (throws or infinite loop)
function fail(message: string): never {
  throw new Error(message);
}
```

## Optional and Default Parameters

```typescript
// Optional parameter with ?
function greet(name: string, greeting?: string): string {
  const g = greeting ?? 'Hello';
  return `${g}, ${name}!`;
}

greet('Alice'); // "Hello, Alice!"
greet('Bob', 'Hi'); // "Hi, Bob!"

// Default parameter
function greet2(name: string, greeting: string = 'Hello'): string {
  return `${greeting}, ${name}!`;
}
```

## Rest Parameters

```typescript
function sum(...numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

console.log(sum(1, 2, 3, 4, 5)); // 15
```

## Function Types

You can describe a function's signature as a type:

```typescript
// Function type alias
type Transformer = (value: string) => string;

const toUpperCase: Transformer = (s) => s.toUpperCase();
const trim: Transformer = (s) => s.trim();

// As a parameter type
function applyAll(value: string, ...fns: Transformer[]): string {
  return fns.reduce((v, fn) => fn(v), value);
}

applyAll('  hello world  ', trim, toUpperCase); // "HELLO WORLD"
```

## Overloads

TypeScript allows multiple function signatures for one implementation:

```typescript
// Overload signatures
function process(value: string): string;
function process(value: number): number;

// Implementation signature (not directly callable)
function process(value: string | number): string | number {
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  return value * 2;
}

process('hello'); // "HELLO" — TypeScript knows it returns string
process(5); // 10 — TypeScript knows it returns number
```

## Functions Over Many Types

Sometimes a function should work for several types without losing track of
which one it was given. Writing `any` gets you there and throws away
everything useful:

```typescript
function first(arr: any[]): any {
  return arr[0];
}

const n = first([1, 2, 3]); // n is any, so n.toUpperCase() compiles and crashes
```

The tool for this is a generic, written with a type parameter in angle
brackets. It has its own lesson later in the course, because doing it well
takes more room than there is here. What is worth knowing now is that the
problem has a proper solution and `any` is not it.

## Callbacks and Higher-Order Functions

```typescript
// Callback type in parameter
function doWithRetry(fn: () => void, times: number): void {
  for (let i = 0; i < times; i++) {
    try {
      fn();
      return;
    } catch {}
  }
}

// Higher-order function that returns a function
function multiplier(factor: number): (n: number) => number {
  return (n) => n * factor;
}

const double = multiplier(2);
const triple = multiplier(3);

console.log(double(5)); // 10
console.log(triple(5)); // 15
```

## Methods in Objects and Classes

```typescript
interface Calculator {
  add(a: number, b: number): number;
  subtract(a: number, b: number): number;
}

const calc: Calculator = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
};
```

## Comparing with JavaScript

```javascript
// JavaScript: no type safety
function divide(a, b) {
  return a / b;
}
divide('10', 2); // Returns NaN at runtime — no warning!
```

```typescript
// TypeScript: compile-time safety
function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}
divide('10', 2); // ❌ Error caught at compile time
```

## Best Practices

1. **Always annotate function parameters** — return types can often be inferred
2. **Use default parameters** instead of `if (param === undefined)`
3. **Prefer arrow functions** for callbacks; use named functions for top-level declarations
4. **Use generics** instead of `any` for flexible but type-safe functions
5. **Document with JSDoc** for public APIs

## Summary

TypeScript's function typing catches bugs early and makes your code more readable. Next, let's look at control flow and how TypeScript narrows types based on conditions.

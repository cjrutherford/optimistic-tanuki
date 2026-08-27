# Hello World in TypeScript

Welcome to TypeScript! In this first lesson, you'll write your very first TypeScript program and understand what makes TypeScript different from JavaScript.

## What is TypeScript?

TypeScript is a **statically typed superset of JavaScript** developed by Microsoft. Every valid JavaScript program is also valid TypeScript — TypeScript simply adds optional type annotations on top.

```typescript
// JavaScript
function greet(name) {
  return 'Hello, ' + name;
}

// TypeScript – same code, but with a type annotation
function greet(name: string): string {
  return 'Hello, ' + name;
}
```

The type annotation `: string` tells TypeScript that `name` must be a string and that the function returns a string. If you accidentally pass a number, TypeScript will catch the mistake **before your code ever runs**.

## Your First Program

```typescript
console.log('Hello, TypeScript!');
```

Run it and you'll see:

```
Hello, TypeScript!
```

Looks familiar? That's the point. TypeScript doesn't change how you write JavaScript — it just adds a safety layer.

## Why TypeScript?

### 1. Catch Errors Early

```typescript
function double(n: number): number {
  return n * 2;
}

double('5'); // ❌ Error: Argument of type 'string' is not assignable to parameter of type 'number'
double(5); // ✅ Returns 10
```

### 2. Better IDE Support

With type information, editors like VS Code can:

- **Auto-complete** method names and properties
- **Show inline documentation** for functions
- **Refactor safely** across your entire codebase

### 3. Self-Documenting Code

```typescript
// What does this do?
function process(x, y) { ... }

// Much clearer:
function processOrder(orderId: string, quantity: number): Order { ... }
```

## TypeScript vs JavaScript: The Journey

If you're coming from JavaScript, think of TypeScript as **JavaScript with a spell checker**. Your existing JS knowledge transfers completely — you're just adding type annotations where helpful.

```typescript
// These are all valid TypeScript:
const name = 'Alice'; // inferred as string
const age: number = 30; // explicit annotation
const scores: number[] = [95, 87, 72]; // typed array
```

## Compiling TypeScript

TypeScript code (`.ts` files) must be compiled to JavaScript before it can run in a browser or Node.js:

```bash
# Turn strict on before you write anything
# (tsc --init writes a tsconfig.json with "strict": true)

# Compile a single file
npx tsc hello.ts

# Or use tsx to run directly (like ts-node):
npx tsx hello.ts
```

On this site, the **Run** button handles compilation automatically — you can focus on learning!

## Turn On Strict Mode First

Every example in this course assumes `"strict": true` in your `tsconfig.json`.
That single flag is what makes TypeScript worth using, and without it a lot of
what follows will silently not apply to your code.

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext"
  }
}
```

The part that matters most is `strictNullChecks`, which `strict` turns on. With
it off, `null` and `undefined` belong to every type, so this compiles and then
crashes at runtime:

```typescript
function greet(name: string) {
  return 'Hello, ' + name.toUpperCase();
}

greet(null); // strict: a compile error. Non-strict: a crash.
```

With strict on, the compiler makes you say when something might be missing, and
then makes you handle it. Almost every guarantee this course describes depends
on it.

There is a full lesson on `tsconfig.json` and on strict mode near the end of
the course. This is the one setting worth turning on before you understand it.

## Key Concepts to Remember

- TypeScript = JavaScript + Types
- Types are optional but highly recommended
- TypeScript catches errors at **compile time**, not runtime
- All JavaScript is valid TypeScript
- TypeScript compiles to clean JavaScript

## Summary

You've taken your first step into TypeScript! In the next lesson, you'll explore variables and the TypeScript type system in depth.

**Quick tip:** Throughout this course, every code example is runnable. Click "Run" to see the output right in your browser.

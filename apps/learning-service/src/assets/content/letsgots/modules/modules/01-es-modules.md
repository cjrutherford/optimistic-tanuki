# ES Modules in TypeScript

TypeScript uses ES module syntax exclusively. This lesson covers everything you need to know about working with modules in a TypeScript project.

## Named Exports and Imports

```typescript
// math.ts
export function add(a: number, b: number): number {
  return a + b;
}
export function subtract(a: number, b: number): number {
  return a - b;
}
export const PI = 3.14159;

// main.ts
import { add, subtract, PI } from './math';
import { add as sum } from './math'; // rename on import
```

## Default Exports

```typescript
// config.ts
export default {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
};

// app.ts
import config from './config';
console.log(config.apiUrl);
```

## Re-exports (Barrel Pattern)

```typescript
// src/index.ts — expose public API
export { add, subtract } from './math';
export { default as config } from './config';
export type { User, Order } from './types';
```

## Type-Only Imports/Exports

```typescript
// Only imports the type — zero runtime cost
import type { User } from './types';

// Mixed
import { createUser, type User } from './users';

// Re-export type only
export type { RequestHandler } from 'express';
```

## Dynamic Imports

```typescript
// Lazy load a module
async function loadDashboard() {
  const { Dashboard } = await import('./Dashboard');
  return new Dashboard();
}

// With type assertion
const module = (await import('./data')) as typeof import('./data');
```

## Summary

ES modules in TypeScript are straightforward — the key addition is `import type` for type-only imports that disappear at runtime.

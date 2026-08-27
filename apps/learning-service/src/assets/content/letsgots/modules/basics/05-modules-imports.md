# Modules and Imports

TypeScript fully supports ES module syntax and enhances it with type imports. Understanding modules is essential for organizing any real TypeScript project.

## ES Module Basics

```typescript
// math.ts — named exports
export function add(a: number, b: number): number {
  return a + b;
}

export const PI = 3.14159;

export interface Point {
  x: number;
  y: number;
}
```

```typescript
// main.ts — named imports
import { add, PI, Point } from './math';

const p: Point = { x: 1, y: 2 };
console.log(add(p.x, p.y)); // 3
console.log(PI); // 3.14159
```

## Default Exports

```typescript
// logger.ts
export default class Logger {
  log(message: string): void {
    console.log(`[LOG] ${message}`);
  }
}
```

```typescript
// app.ts
import Logger from './logger';

const logger = new Logger();
logger.log('App started');
```

## Re-exporting

```typescript
// index.ts — barrel file pattern
export { add, PI } from './math';
export type { Point } from './math';
export { default as Logger } from './logger';
```

Now consumers can import from a single location:

```typescript
import { add, Logger, type Point } from './utils';
```

## Type-Only Imports

In TypeScript, you can import types without any runtime cost:

```typescript
// These imports are erased at compile time
import type { User } from './types';
import type { RequestHandler } from 'express';

// Mixed import
import { createUser, type User } from './users';
```

Using `import type` is a best practice — it makes your intent clear and enables better tree-shaking.

## Namespace Imports

```typescript
import * as MathUtils from './math';

console.log(MathUtils.add(1, 2));
console.log(MathUtils.PI);
```

## Dynamic Imports

Load modules lazily at runtime:

```typescript
async function loadHeavyModule() {
  const { HeavyFeature } = await import('./heavy-feature');
  const feature = new HeavyFeature();
  feature.run();
}
```

## Declaration Files (.d.ts)

When using plain JavaScript libraries, TypeScript needs type declarations:

```typescript
// types.d.ts — manually declaring a JS module
declare module 'some-js-library' {
  export function doThing(value: string): number;
  export const version: string;
}
```

Most popular libraries have community types via `@types/*`:

```bash
npm install --save-dev @types/lodash
npm install --save-dev @types/node
```

## Module Resolution

TypeScript supports several module resolution strategies. For modern projects, use `"moduleResolution": "bundler"` in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

## Path Aliases

Avoid deep relative imports with path aliases:

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"]
    }
  }
}
```

```typescript
// Before
import { Button } from '../../../components/Button';

// After
import { Button } from '@components/Button';
```

## Best Practices

1. **Use named exports** for most things — they're easier to refactor
2. **Use default exports** sparingly — makes renaming imports harder
3. **Use `import type`** for type-only imports
4. **Create barrel files** (`index.ts`) to expose a clean public API
5. **Avoid circular imports** — they can cause subtle runtime bugs

## Summary

You now understand TypeScript's module system. In the next module, we'll explore how to migrate existing JavaScript code to TypeScript step by step.

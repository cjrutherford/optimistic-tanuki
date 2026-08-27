# Declaration Files

Declaration files (`.d.ts`) describe the types of JavaScript libraries, letting TypeScript understand code it can't directly analyze.

## What Are Declaration Files?

When you install `@types/lodash`, you get a `.d.ts` file that tells TypeScript about Lodash's API — without any JavaScript implementation:

```typescript
// lodash/index.d.ts (simplified)
declare function chunk<T>(array: T[], size?: number): T[][];
declare function flatten<T>(array: Array<T | T[]>): T[];
export { chunk, flatten };
```

## Writing Declaration Files

For an untyped library `legacy-lib`:

```typescript
// types/legacy-lib.d.ts
declare module 'legacy-lib' {
  export interface Options {
    timeout?: number;
    retries?: number;
  }
  export function doThing(input: string, options?: Options): Promise<string>;
  export const version: string;
}
```

## Ambient Declarations

Declare globals without a module:

```typescript
// globals.d.ts
declare const __DEV__: boolean;
declare const __VERSION__: string;

interface Window {
  analytics: Analytics;
  gtag: (...args: unknown[]) => void;
}
```

## Triple-Slash Directives

Reference other declaration files:

```typescript
/// <reference types="node" />
/// <reference path="./custom.d.ts" />
```

## Summary

Declaration files are TypeScript's bridge to the JavaScript ecosystem. Understanding them helps you type any library you encounter.

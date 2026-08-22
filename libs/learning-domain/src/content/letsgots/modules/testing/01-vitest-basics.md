# Vitest Basics

Vitest is a Vite-native testing framework that's fast, TypeScript-first, and Jest-compatible. It's the recommended testing tool for TypeScript projects.

## Setup

```bash
npm install --save-dev vitest @vitest/ui
```

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Your First Tests

```typescript
// math.test.ts
import { describe, it, expect } from 'vitest';
import { add, multiply } from './math';

describe('add', () => {
  it('adds two positive numbers', () => {
    expect(add(1, 2)).toBe(3);
  });

  it('handles negative numbers', () => {
    expect(add(-1, 1)).toBe(0);
  });
});

describe('multiply', () => {
  it('multiplies correctly', () => {
    expect(multiply(3, 4)).toBe(12);
  });
});
```

## Common Matchers

```typescript
expect(value).toBe(3); // strict equality
expect(value).toEqual({ x: 1 }); // deep equality
expect(array).toContain('item'); // array contains
expect(fn).toThrow('error message'); // throws error
expect(promise).resolves.toBe('value'); // async resolution
expect(promise).rejects.toThrow(); // async rejection
```

## Summary

Vitest makes testing TypeScript code a pleasure. Its fast HMR and TypeScript-native support mean you spend less time on tooling and more time writing good tests.

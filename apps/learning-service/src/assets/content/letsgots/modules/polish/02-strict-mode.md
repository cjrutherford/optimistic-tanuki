# Strict Mode and Best Practices

TypeScript's strict mode enables a set of checks that catch entire categories of bugs. This lesson explains each check and when to use them.

## What `strict: true` Enables

```json
{
  "compilerOptions": {
    "strict": true
    // Equivalent to all of:
    // "noImplicitAny": true
    // "noImplicitThis": true
    // "alwaysStrict": true
    // "strictBindCallApply": true
    // "strictNullChecks": true
    // "strictFunctionTypes": true
    // "strictPropertyInitialization": true
  }
}
```

## strictNullChecks

The most impactful strict option:

```typescript
// Without strictNullChecks — dangerous!
function getName(user: User | null): string {
  return user.name; // No error — crashes at runtime if user is null!
}

// With strictNullChecks — safe
function getName(user: User | null): string {
  if (user === null) return 'Anonymous';
  return user.name; // TypeScript knows user is not null here
}
```

## Nullish Coalescing (`??`) and Optional Chaining (`?.`)

```typescript
interface Config {
  db?: { host?: string; port?: number };
}

const host = config.db?.host ?? 'localhost';
const port = config.db?.port ?? 5432;
// Both safely handle undefined without crashing
```

## Non-Null Assertion (`!`)

Use sparingly — you're telling TypeScript "trust me":

```typescript
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!; // Assert non-null

// Better: check first
const ctx2 = canvas.getContext('2d');
if (!ctx2) throw new Error('Canvas 2D not supported');
```

## Best Practices Summary

1. **Start with `strict: true`** in all new projects
2. **Never use `any`** — use `unknown` + type guards
3. **Check for null** — never assume values exist
4. **Use `const` by default** — `let` only when reassignment is needed
5. **Add `noUncheckedIndexedAccess`** for even stricter array safety

## Summary

Strict mode is TypeScript at its best. The small upfront investment in writing stricter code pays massive dividends in avoided runtime errors.

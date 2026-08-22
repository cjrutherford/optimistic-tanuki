# tsconfig Deep Dive

`tsconfig.json` is the heart of any TypeScript project. Understanding its options lets you fine-tune type checking to your needs.

## Key Compiler Options

```json
{
  "compilerOptions": {
    // Target JavaScript version
    "target": "ES2022",

    // Module system
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Strictness
    "strict": true, // enables all strict checks
    "noImplicitAny": true, // no implicit any
    "strictNullChecks": true, // null/undefined are separate types
    "strictFunctionTypes": true, // stricter function compatibility
    "noUncheckedIndexedAccess": true, // array[i] returns T | undefined

    // Code quality
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    // Output
    "outDir": "./dist",
    "declaration": true, // generate .d.ts files
    "sourceMap": true,
    "noEmit": false
  }
}
```

## Project References

Split large projects into smaller pieces:

```json
// tsconfig.json (root)
{
  "references": [{ "path": "./packages/core" }, { "path": "./packages/api" }, { "path": "./packages/ui" }]
}
```

## `noUncheckedIndexedAccess`

A highly recommended strict option:

```typescript
// Without noUncheckedIndexedAccess:
const arr: string[] = [];
const value = arr[0]; // string — but could be undefined!

// With noUncheckedIndexedAccess:
const value = arr[0]; // string | undefined — honest!
if (value !== undefined) {
  console.log(value.toUpperCase()); // safe
}
```

## Summary

Master your tsconfig to get the most from TypeScript. Start strict and only loosen options for very specific reasons.

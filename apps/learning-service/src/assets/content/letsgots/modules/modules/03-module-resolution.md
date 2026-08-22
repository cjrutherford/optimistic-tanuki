# Module Resolution

Understanding how TypeScript finds modules helps you configure projects correctly and debug import errors.

## Resolution Strategies

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler" // Best for Vite, esbuild, etc.
    // "node16"   — For Node.js ESM
    // "nodenext" — For Node.js latest
    // "node"     — Legacy Node.js CJS
  }
}
```

## Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@lib/*": ["src/lib/*"]
    }
  }
}
```

```typescript
// Without aliases
import { Button } from '../../../components/ui/Button';

// With aliases
import { Button } from '@components/ui/Button';
```

## Node.js vs Bundler Resolution

With `"moduleResolution": "bundler"`:

- Extensions are optional in imports
- `index.ts` files are found automatically
- Works with Vite, esbuild, webpack

With `"moduleResolution": "node16"`:

- Extensions required in ESM imports
- Strict module boundary enforcement

## Summary

Use `"moduleResolution": "bundler"` for frontend projects with Vite/webpack, and configure path aliases to keep imports clean.

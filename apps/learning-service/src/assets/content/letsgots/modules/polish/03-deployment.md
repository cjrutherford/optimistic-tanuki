# TypeScript Deployment

Deploying TypeScript projects requires a build step. Here are the patterns for production-ready deployments.

## Build Process

```bash
# Compile TypeScript to JavaScript
npx tsc

# Or use a bundler (Vite, esbuild, etc.)
npm run build
```

## Production tsconfig

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "declaration": false,
    "sourceMap": true,
    "removeComments": true,
    "strict": true,
    "noEmit": false
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

## Docker with TypeScript

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --production
CMD ["node", "dist/index.js"]
```

## Environment Configuration

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});

// Validate at startup — fail fast if misconfigured
export const env = envSchema.parse(process.env);
```

## Performance: Path-Based Code Splitting

```typescript
// Lazy load heavy modules
const { runAnalysis } = await import('./analysis');
```

## Summary

TypeScript deployment is straightforward: compile, bundle, and ship. Use multi-stage Docker builds for efficient container images and validate environment configuration at startup.

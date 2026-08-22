# Node.js with TypeScript

Node.js and TypeScript work great together. This lesson covers setting up a type-safe Node.js project.

## Project Setup

```bash
npm init -y
npm install typescript tsx @types/node --save-dev
npx tsc --init
```

```json
// tsconfig.json for Node.js
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node16",
    "outDir": "./dist",
    "strict": true
  }
}
```

## File System Operations

```typescript
import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

interface Config {
  host: string;
  port: number;
}
const config = await readJsonFile<Config>('./config.json');
```

## Environment Variables

```typescript
function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

const port = parseInt(getEnvVar('PORT'), 10);
const dbUrl = getEnvVar('DATABASE_URL');
```

## Type Guards for Node APIs

```typescript
import { isNativeError } from 'util/types';

function handleError(err: unknown): string {
  if (isNativeError(err)) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}
```

## Summary

TypeScript in Node.js gives you the same safety as frontend TypeScript. Start strict and use `@types/node` for full Node.js API types.

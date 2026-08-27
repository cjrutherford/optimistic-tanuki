# Type-Safe REST APIs

Building a complete REST API with TypeScript means typing the entire request/response cycle.

## Shared Types (API Contract)

```typescript
// shared/types.ts — used by both server and client
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string; // ISO string for JSON serialization
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface ApiError {
  error: string;
  code: string;
  status: number;
}
```

## Input Validation

```typescript
function validateCreateUserInput(body: unknown): CreateUserInput {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Body must be an object');
  }
  const { name, email } = body as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('name must be a non-empty string');
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new ValidationError('email must be valid');
  }
  return { name: name.trim(), email: email.toLowerCase() };
}
```

## OpenAPI Integration

```typescript
// Generate OpenAPI spec from TypeScript types
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
});

type CreateUserInput = z.infer<typeof createUserSchema>;
```

## Summary

A type-safe API means bugs are caught at compile time, not at 3 AM in production. Share types between your server and client to eliminate an entire class of integration errors.

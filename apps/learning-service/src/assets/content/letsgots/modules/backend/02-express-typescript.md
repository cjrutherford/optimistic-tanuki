# Express with TypeScript

Express.js with TypeScript gives you type-safe request handling, middleware, and response types.

## Setup

```bash
npm install express
npm install --save-dev @types/express
```

## Typed Request Handlers

```typescript
import express, { Request, Response, NextFunction } from 'express';

const app = express();
app.use(express.json());

// Typed route params, query, and body
interface UserParams {
  id: string;
}
interface UserQuery {
  include?: 'posts' | 'followers';
}
interface UpdateUserBody {
  name?: string;
  email?: string;
}

app.get<UserParams, User, never, UserQuery>('/users/:id', async (req, res) => {
  const { id } = req.params; // string
  const { include } = req.query; // "posts" | "followers" | undefined
  const user = await findUser(id, include);
  res.json(user);
});

app.put<UserParams, User, UpdateUserBody>('/users/:id', async (req, res) => {
  const user = await updateUser(req.params.id, req.body);
  res.json(user);
});
```

## Typed Middleware

```typescript
interface AuthenticatedRequest extends Request {
  user: User;
}

function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = verifyToken(token);
  (req as AuthenticatedRequest).user = user;
  next();
}
```

## Error Handling Middleware

```typescript
interface ApiError extends Error {
  status: number;
  code: string;
}

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (isApiError(err)) {
    res.status(err.status).json({ error: err.message, code: err.code });
  } else {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Summary

TypeScript + Express creates a type-safe API layer. Typed request handlers prevent accessing non-existent properties and guide you toward correct API design.

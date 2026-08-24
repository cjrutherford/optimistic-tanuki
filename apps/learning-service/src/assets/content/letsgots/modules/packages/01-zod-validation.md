# Zod for Validation

Zod is a TypeScript-first schema validation library. Define your schema once and get both runtime validation and TypeScript types automatically.

## Installation

```bash
npm install zod
```

> **Versions.** This lesson is written against Zod 4. Zod 3 is still widely
> deployed and most of what follows is identical in both. Where they differ it
> is called out. If you are reading a Zod 3 codebase, expect string formats
> written as methods — `z.string().email()` rather than `z.email()` — and
> `error.format()` where this lesson uses `error.issues`. The Zod 3 spellings
> still work in Zod 4; they are deprecated, not removed.

## Basic Schemas

```typescript
import { z } from 'zod';

// Primitives
const nameSchema = z.string().min(1).max(100);
const ageSchema = z.number().int().min(0).max(150);
const emailSchema = z.string().email();

// Object schema
const userSchema = z.object({
  id: z.string().uuid(),
  name: nameSchema,
  age: ageSchema,
  email: emailSchema,
  role: z.enum(['admin', 'user']).default('user'),
  tags: z.array(z.string()).optional(),
});

// Infer TypeScript type from schema — no duplication!
type User = z.infer<typeof userSchema>;
```

## Parsing and Validation

```typescript
// parse — throws on failure
const user = userSchema.parse({ name: 'Alice', age: 30, email: 'alice@example.com' });

// safeParse — returns result object
const result = userSchema.safeParse(unknownData);
if (result.success) {
  console.log(result.data.name); // typed as User
} else {
  // error.issues is a flat array of what failed and where. It is the one
  // shape that has stayed the same across Zod 3 and 4.
  for (const issue of result.error.issues) {
    console.error(`${issue.path.join('.')}: ${issue.message}`);
  }
}
```

## Transformations

```typescript
const trimmedEmailSchema = z
  .string()
  .email()
  .transform((email) => email.toLowerCase().trim());

const dateSchema = z.string().transform((str) => new Date(str));
```

## Zod with Express

```typescript
app.post('/users', async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }
  const user = await createUser(result.data); // data is fully typed
  res.json(user);
});
```

## Summary

Zod eliminates the gap between your type definitions and your runtime validation. One schema definition gives you types AND validation.

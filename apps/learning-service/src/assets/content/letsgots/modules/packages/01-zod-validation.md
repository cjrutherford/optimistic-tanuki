# Zod for Validation

Zod is a TypeScript-first schema validation library. Define your schema once and get both runtime validation and TypeScript types automatically.

## Installation

```bash
npm install zod
```

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
  console.error(result.error.format()); // detailed error info
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
    res.status(400).json({ errors: result.error.format() });
    return;
  }
  const user = await createUser(result.data); // data is fully typed
  res.json(user);
});
```

## Summary

Zod eliminates the gap between your type definitions and your runtime validation. One schema definition gives you types AND validation.

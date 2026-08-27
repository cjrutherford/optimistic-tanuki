# Prisma ORM

Prisma is a type-safe ORM for TypeScript with a powerful schema language and fully generated types.

## Setup

```bash
npm install prisma @prisma/client
npx prisma init
```

## Schema Definition

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
}
```

## Type-Safe Queries

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create — fully typed
const user = await prisma.user.create({
  data: { name: 'Alice', email: 'alice@example.com' },
});
// user.id, user.name, user.email are all typed

// Find with relations
const userWithPosts = await prisma.user.findUnique({
  where: { id: 'alice-id' },
  include: { posts: { where: { published: true } } },
});
// userWithPosts?.posts is Post[]

// Update
const updated = await prisma.post.update({
  where: { id: 'post-id' },
  data: { published: true },
});
```

## Generated Types

```typescript
import { User, Post, Prisma } from '@prisma/client';

// Use generated input types
type CreateUserInput = Prisma.UserCreateInput;
type UpdatePostInput = Prisma.PostUpdateInput;

// Select only specific fields
type UserPreview = Prisma.UserGetPayload<{
  select: { id: true; name: true; email: true };
}>;
```

## Summary

Prisma generates TypeScript types from your database schema, making database operations type-safe end-to-end. Schema changes automatically update your types.

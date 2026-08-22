# Utility Types

TypeScript ships with a rich set of built-in utility types that transform existing types. These are the tools you'll reach for daily in real-world TypeScript code.

## Property Modifiers

### `Partial<T>`

Makes all properties optional:

```typescript
interface User {
  name: string;
  age: number;
  email: string;
}

type UserUpdate = Partial<User>;
// { name?: string; age?: number; email?: string }

function updateUser(user: User, changes: Partial<User>): User {
  return { ...user, ...changes };
}
```

### `Required<T>`

Makes all properties required:

```typescript
type RequiredUser = Required<Partial<User>>;
// All optional properties become required
```

### `Readonly<T>`

Makes all properties non-writable:

```typescript
const config: Readonly<AppConfig> = { host: 'localhost', port: 3000 };
config.host = 'other'; // ❌ Error: cannot assign to readonly property
```

## Selection and Omission

### `Pick<T, K>`

Create a type with only specified keys:

```typescript
type UserPreview = Pick<User, 'name' | 'email'>;
// { name: string; email: string }
```

### `Omit<T, K>`

Create a type without specified keys:

```typescript
type CreateUserInput = Omit<User, 'id' | 'createdAt'>;
// { name: string; age: number; email: string }
```

## Unions

### `Exclude<T, U>`

Remove types from a union:

```typescript
type Primitive = string | number | boolean | null | undefined;
type NonNullPrimitive = Exclude<Primitive, null | undefined>;
// string | number | boolean
```

### `Extract<T, U>`

Keep only types assignable to U:

```typescript
type StringOrNumber = Extract<string | number | boolean, string | number>;
// string | number
```

### `NonNullable<T>`

Remove `null` and `undefined`:

```typescript
type MaybeString = string | null | undefined;
type DefiniteString = NonNullable<MaybeString>;
// string
```

## Function Utilities

### `ReturnType<T>`

Get the return type of a function:

```typescript
function createUser(name: string, age: number) {
  return { id: crypto.randomUUID(), name, age, createdAt: new Date() };
}

type CreatedUser = ReturnType<typeof createUser>;
// { id: string; name: string; age: number; createdAt: Date }
```

### `Parameters<T>`

Get the parameter types as a tuple:

```typescript
type CreateUserParams = Parameters<typeof createUser>;
// [name: string, age: number]
```

### `ConstructorParameters<T>`

Get constructor parameters:

```typescript
class User {
  constructor(public name: string, public role: 'admin' | 'user') {}
}
type UserConstructorArgs = ConstructorParameters<typeof User>;
// [string, "admin" | "user"]
```

## Advanced Utilities

### `Record<K, V>`

Create an object type with specific key and value types:

```typescript
type ScoreMap = Record<string, number>;
const scores: ScoreMap = { alice: 95, bob: 87 };

// More specific:
type UserRoles = Record<'admin' | 'editor' | 'viewer', string[]>;
const roles: UserRoles = {
  admin: ['alice'],
  editor: ['bob', 'charlie'],
  viewer: ['dave'],
};
```

### `Awaited<T>`

Unwrap a Promise type:

```typescript
type ResolvedUser = Awaited<Promise<User>>;
// User

type DeepResolved = Awaited<Promise<Promise<string>>>;
// string
```

## Composing Utility Types

The real power comes from combining them:

```typescript
interface BlogPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  tags: string[];
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// For creating a new post (no id or timestamps)
type CreatePostInput = Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>;

// For updating (all optional, no id or timestamps)
type UpdatePostInput = Partial<Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>>;

// Public view (no authorId)
type PublicPost = Omit<BlogPost, 'authorId'>;

// Draft view (only id, title, publishedAt)
type PostSummary = Pick<BlogPost, 'id' | 'title' | 'publishedAt'>;
```

## Best Practices

1. **Derive types from source types** rather than duplicating — changes propagate automatically
2. **Combine utilities** to express complex type relationships
3. **Name derived types clearly** — `CreateUserInput` not just `PartialUser`
4. **Use `ReturnType`** to keep derived types in sync with function changes
5. **Prefer `Omit` over retyping** when you need most of a type

## Summary

TypeScript's utility types are productivity multipliers. They let you derive new types from existing ones, keeping your type definitions DRY and consistent with their sources.

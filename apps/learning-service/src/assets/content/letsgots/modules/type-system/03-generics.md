# Generics

Generics are the cornerstone of reusable, type-safe code in TypeScript. They allow you to write functions, classes, and types that work with multiple types while preserving full type information.

## The Problem Generics Solve

Without generics, you'd have to choose between code duplication or losing type safety:

```typescript
// Duplicate code — bad
function wrapString(value: string): { value: string } {
  return { value };
}
function wrapNumber(value: number): { value: number } {
  return { value };
}

// Using any — loses type safety
function wrapAny(value: any): { value: any } {
  return { value };
}
const wrapped = wrapAny('hello');
wrapped.value.toUpperCase(); // No autocomplete, no type checking
```

```typescript
// Generics — reusable AND type-safe ✅
function wrap<T>(value: T): { value: T } {
  return { value };
}

const wrappedStr = wrap('hello'); // { value: string }
const wrappedNum = wrap(42); // { value: number }
wrappedStr.value.toUpperCase(); // ✅ TypeScript knows it's a string
```

## Generic Functions

```typescript
// Identity function
function identity<T>(value: T): T {
  return value;
}

// First element of array
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

// Swap tuple
function swap<A, B>(pair: [A, B]): [B, A] {
  return [pair[1], pair[0]];
}

const [b, a] = swap(['hello', 42]); // [number, string]
```

## Generic Constraints

Constrain the allowed types with `extends`:

```typescript
// T must have a length property
function getLength<T extends { length: number }>(value: T): number {
  return value.length;
}

getLength('hello'); // 5
getLength([1, 2, 3]); // 3
getLength({ length: 7 }); // 7
getLength(42); // ❌ number has no length

// T must be an object key type
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: 'Alice', age: 30 };
const name = getProperty(user, 'name'); // string
const age = getProperty(user, 'age'); // number
getProperty(user, 'email'); // ❌ not a key of user
```

## Generic Interfaces

```typescript
interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>
  findAll(): Promise<T[]>
  create(data: Omit<T, "id">): Promise<T>
  update(id: ID, data: Partial<T>): Promise<T>
  delete(id: ID): Promise<void>
}

interface User {
  id: string
  name: string
  email: string
}

class UserRepository implements Repository<User> {
  async findById(id: string): Promise<User | null> { ... }
  async findAll(): Promise<User[]> { ... }
  // ...
}
```

## Generic Classes

```typescript
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  get size(): number {
    return this.items.length;
  }
}

const numStack = new Stack<number>();
numStack.push(1);
numStack.push(2);
numStack.pop(); // 2 — TypeScript knows it's number | undefined
```

## Generic Type Aliases

```typescript
type Pair<A, B> = { first: A; second: B };
type Maybe<T> = T | null | undefined;
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
type Nullable<T> = { [K in keyof T]: T[K] | null };
```

## Default Type Parameters

```typescript
interface PaginatedResponse<T, Meta = PaginationMeta> {
  data: T[];
  meta: Meta;
  total: number;
}

interface PaginationMeta {
  page: number;
  perPage: number;
}

// Uses default Meta type:
type UserResponse = PaginatedResponse<User>;

// Custom Meta:
type SearchResponse = PaginatedResponse<User, { query: string; hits: number }>;
```

## Practical: A Generic `useLocalStorage` Hook

```typescript
function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const stored = localStorage.getItem(key);
  const initial = stored ? (JSON.parse(stored) as T) : defaultValue;

  const setter = (value: T): void => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  return [initial, setter];
}

// TypeScript infers T = User from the default value
const [user, setUser] = useLocalStorage<User>('user', { id: '', name: '', email: '' });
```

## Best Practices

1. **Use single capital letters** (`T`, `K`, `V`) for simple generics, descriptive names for complex ones
2. **Add constraints** instead of `any` when you need specific capabilities
3. **Use default type parameters** for optional type arguments
4. **Don't over-generalize** — only add generics when you actually need them
5. **Prefer `T extends object`** over `T` when you know the type should be an object

## Summary

Generics are what make TypeScript's type system truly expressive. They let you write once, use many times — with full type safety preserved throughout.

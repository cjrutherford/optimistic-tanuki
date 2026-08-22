# Union and Intersection Types

Union and intersection types are the algebraic building blocks of TypeScript's type system. They let you compose types in powerful ways.

## Union Types (`|`)

A union type represents a value that can be **one of several types**:

```typescript
type StringOrNumber = string | number;

function display(value: StringOrNumber): void {
  console.log(value);
}

display('hello'); // ✅
display(42); // ✅
display(true); // ❌ boolean not in union
```

### Discriminated Unions

The most powerful use of unions is with a "discriminant" property:

```typescript
type NetworkState = { status: 'loading' } | { status: 'success'; data: string[] } | { status: 'error'; error: Error };

function renderState(state: NetworkState) {
  switch (state.status) {
    case 'loading':
      return 'Loading...';
    case 'success':
      return state.data.join(', '); // TypeScript knows data exists
    case 'error':
      return `Error: ${state.error.message}`; // TypeScript knows error exists
  }
}
```

### Union with Literal Types

```typescript
type Alignment = 'left' | 'center' | 'right';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function setAlignment(el: HTMLElement, align: Alignment) {
  el.style.textAlign = align;
}
```

## Intersection Types (`&`)

An intersection type combines **multiple types into one**:

```typescript
type Named = { name: string };
type Aged = { age: number };
type Person = Named & Aged;

const alice: Person = {
  name: 'Alice',
  age: 30,
};
// Must have BOTH name AND age
```

### Intersection for Mixins

```typescript
type Timestamped = {
  createdAt: Date;
  updatedAt: Date;
};

type Identifiable = {
  id: string;
};

type BaseEntity = Identifiable & Timestamped;

interface User extends BaseEntity {
  name: string;
  email: string;
}
// User has: id, createdAt, updatedAt, name, email
```

### Intersection with Functions

```typescript
type Loggable = {
  log(message: string): void;
};

type Serializable = {
  serialize(): string;
};

type LoggableAndSerializable = Loggable & Serializable;

function processEntity(entity: LoggableAndSerializable) {
  entity.log('Processing...');
  const data = entity.serialize();
  return data;
}
```

## Union vs Intersection: Mental Model

| Union (`A                        | B`)                             | Intersection (`A & B`) |
| -------------------------------- | ------------------------------- | ---------------------- |
| "Either A or B"                  | "Both A and B"                  |
| Has properties common to A and B | Has all properties from A and B |
| Wider set of values              | Narrower set of values          |
| Use for variants                 | Use for mixins/extensions       |

```typescript
type A = { x: number };
type B = { y: number };

type AorB = A | B; // Has x OR y (not necessarily both)
type AandB = A & B; // Must have BOTH x AND y
```

## Narrowing Unions

```typescript
type StringOrArray = string | string[];

function normalize(value: StringOrArray): string[] {
  if (typeof value === 'string') {
    return [value]; // narrowed to string
  }
  return value; // narrowed to string[]
}
```

## Optional Properties vs Union with Undefined

```typescript
// These are slightly different:
interface A {
  name?: string; // name can be omitted OR undefined
}

interface B {
  name: string | undefined; // name must be present, but can be undefined
}

const a: A = {}; // ✅
const b: B = {}; // ❌ Error: name is required
const b2: B = { name: undefined }; // ✅
```

## Practical: API Response Type

```typescript
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function fetchUser(id: string): Promise<ApiResponse<User>> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) {
    return { ok: false, error: 'Not found', status: res.status };
  }
  const data = (await res.json()) as User;
  return { ok: true, data };
}

// Usage
const result = await fetchUser('123');
if (result.ok) {
  console.log(result.data.name); // TypeScript knows data exists
} else {
  console.log(result.error); // TypeScript knows error exists
}
```

## Best Practices

1. **Use discriminated unions** over inheritance hierarchies for variants
2. **Keep union members small** — large unions are hard to maintain
3. **Use intersection types** instead of multiple interface inheritance for mixins
4. **Combine with generics** for reusable patterns
5. **Add exhaustiveness checks** for switch statements over unions

## Summary

Union and intersection types are fundamental tools. Unions model "this or that", intersections model "this and that". Together they cover virtually every type combination you'll need.

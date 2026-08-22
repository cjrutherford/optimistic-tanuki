# Interfaces vs Type Aliases

TypeScript gives you two ways to describe object shapes: `interface` and `type`. Understanding when to use each is one of the most common questions for TypeScript learners.

## Interfaces

Interfaces define the shape of an object. They're the primary tool for describing object types in TypeScript.

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  age?: number; // optional property
  readonly createdAt: Date; // cannot be changed after creation
}

const user: User = {
  id: 'abc-123',
  name: 'Alice',
  email: 'alice@example.com',
  createdAt: new Date(),
};
```

## Type Aliases

Type aliases can describe any type — objects, primitives, unions, tuples, and more:

```typescript
type UserId = string;
type Score = number;
type Coordinates = [number, number];
type Status = 'active' | 'inactive' | 'pending';

type User = {
  id: UserId;
  name: string;
  status: Status;
};
```

## Key Differences

### Declaration Merging (Interfaces Only)

```typescript
interface Window {
  title: string;
}

interface Window {
  // ✅ Merges with the previous declaration
  customProperty: string;
}

// Now Window has both title and customProperty
```

Type aliases cannot be merged — redeclaration is an error.

### Extends vs Intersection

```typescript
// Interfaces use extends
interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
}

// Type aliases use & (intersection)
type Animal = { name: string };
type Dog = Animal & { breed: string };
```

Both achieve the same result for simple cases.

### Computed Properties

```typescript
// Type aliases support computed property names
type Keys = 'first' | 'last';
type Name = {
  [K in Keys]: string; // mapped type — only possible with type aliases
};

// Interfaces cannot use mapped types
```

### Implementing Interfaces in Classes

```typescript
interface Printable {
  print(): void;
}

class Document implements Printable {
  print() {
    console.log('Printing...');
  }
}
```

Both `interface` and `type` can be implemented by classes.

## When to Use Each

| Use `interface` when...       | Use `type` when...             |
| ----------------------------- | ------------------------------ |
| Defining object shapes        | Creating unions/intersections  |
| Describing class contracts    | Aliasing primitives            |
| You want declaration merging  | Using mapped/conditional types |
| Working with third-party code | Defining tuple types           |
| Public library APIs           | Complex type transformations   |

## Practical Example

```typescript
// Domain model — interface (mergeable, clear intent)
interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
}

// Union type — type alias (interfaces can't do unions)
type Category = 'electronics' | 'clothing' | 'food' | 'books';

// Utility type — type alias (transformation)
type CreateProductInput = Omit<Product, 'id'> & {
  id?: string;
};

// Class contract — interface (conventional)
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}
```

## The Team Convention Approach

Many teams pick one and stick to it for consistency:

```
Option A: "Always interface for objects, type for everything else"
Option B: "Always type" (simpler mental model)
Option C: "interface for public APIs, type for internals"
```

The TypeScript team's recommendation: **use `interface` by default, switch to `type` when you need features only `type` supports**.

## Best Practices

1. **Prefer `interface` for object shapes** that might need extending
2. **Use `type`** for unions, intersections, and complex transformations
3. **Never mix** both styles arbitrarily — pick a convention
4. **Use `readonly`** on properties that shouldn't change after creation
5. **Use `?`** for genuinely optional properties (not properties with `undefined`)

## Summary

Interfaces and type aliases are more similar than different. The key distinction is that interfaces support declaration merging and feel more natural for OOP patterns, while type aliases support powerful transformations. Choose based on your use case.

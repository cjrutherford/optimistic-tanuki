# Type-Safe Testing

TypeScript's type system applies inside your tests too — helping you write better, more maintainable test suites.

## Typed Test Data

```typescript
import { describe, it, expect } from 'vitest';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

// Type-safe test fixtures
const testUser: User = {
  id: 'test-123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
};

// Factory function for test data
function createTestUser(overrides: Partial<User> = {}): User {
  return { ...testUser, ...overrides };
}

const adminUser = createTestUser({ role: 'admin' });
```

## Testing Type Guards

```typescript
function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'id' in value && 'name' in value;
}

describe('isUser', () => {
  it('returns true for valid user', () => {
    expect(isUser(testUser)).toBe(true);
  });
  it('returns false for null', () => {
    expect(isUser(null)).toBe(false);
  });
});
```

## Testing Async Code

```typescript
describe('fetchUser', () => {
  it('returns a user', async () => {
    const user = await fetchUser('alice');
    expect(user).toMatchObject({ name: expect.any(String) });
  });

  it('throws for unknown user', async () => {
    await expect(fetchUser('unknown')).rejects.toThrow('Not found');
  });
});
```

## Summary

Type-safe tests catch more bugs and are easier to maintain. Using TypeScript in tests gives you the same safety as in production code.

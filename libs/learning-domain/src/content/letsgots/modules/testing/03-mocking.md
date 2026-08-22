# Mocking in TypeScript

Mocking replaces real dependencies with controlled fakes. Vitest provides built-in mocking with full TypeScript support.

## Basic Mocking

```typescript
import { vi, describe, it, expect } from 'vitest';

// Mock a module
vi.mock('./api', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: '1', name: 'Alice' }),
}));

import { fetchUser } from './api';

it('uses mocked fetchUser', async () => {
  const user = await fetchUser('1');
  expect(user.name).toBe('Alice');
  expect(fetchUser).toHaveBeenCalledWith('1');
});
```

## Type-Safe Mocks

```typescript
import { vi } from 'vitest';

interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

// Creates a fully typed mock
const mockEmailService: EmailService = {
  send: vi.fn().mockResolvedValue(undefined),
};

// TypeScript ensures you only call real methods
mockEmailService.send('alice@example.com', 'Hello', 'Body');
```

## Spying

```typescript
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

myFunction();

expect(consoleSpy).toHaveBeenCalledWith('expected message');
consoleSpy.mockRestore();
```

## Summary

Vitest's mocking APIs are fully typed — TypeScript catches incorrect mock implementations before your tests even run.

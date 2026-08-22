# Async/Await in TypeScript

Async/await is syntactic sugar over Promises, making asynchronous code read like synchronous code. TypeScript fully supports it with complete type inference.

## Basic Async/Await

```typescript
// An async function always returns a Promise
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`User not found: ${id}`);
  }
  return response.json() as Promise<User>;
}

// Calling it
const user = await fetchUser('alice');
console.log(user.name); // TypeScript knows user is User
```

## Error Handling

```typescript
async function loadProfile(userId: string): Promise<Profile | null> {
  try {
    const user = await fetchUser(userId);
    const settings = await fetchSettings(userId);
    return buildProfile(user, settings);
  } catch (err) {
    if (err instanceof NetworkError) {
      console.error('Network issue:', err.message);
      return null;
    }
    // Re-throw unexpected errors
    throw err;
  } finally {
    cleanup();
  }
}
```

## Sequential vs Parallel Execution

```typescript
// Sequential — each awaits the previous (slower)
async function sequential(ids: string[]): Promise<User[]> {
  const users: User[] = [];
  for (const id of ids) {
    const user = await fetchUser(id); // waits for each
    users.push(user);
  }
  return users;
}

// Parallel — all run at once (faster)
async function parallel(ids: string[]): Promise<User[]> {
  return Promise.all(ids.map(fetchUser)); // all start immediately
}
```

## Async Iterators

```typescript
async function* generateIds(): AsyncGenerator<string> {
  for (let i = 0; i < 10; i++) {
    await sleep(100);
    yield `id-${i}`;
  }
}

async function processAll() {
  for await (const id of generateIds()) {
    const user = await fetchUser(id);
    processUser(user);
  }
}
```

## Timeouts and Cancellation

```typescript
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms));
  return Promise.race([promise, timeout]);
}

// With AbortController
async function fetchWithCancel(url: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(url, { signal });
  if (signal.aborted) throw new Error('Aborted');
  return response;
}

const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

try {
  const data = await fetchWithCancel('/api/data', controller.signal);
} catch (err) {
  if (err instanceof Error && err.name === 'AbortError') {
    console.log('Request was cancelled');
  }
}
```

## Async Class Methods

```typescript
class UserService {
  private cache = new Map<string, User>();

  async getUser(id: string): Promise<User> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }
    const user = await fetchUser(id);
    this.cache.set(id, user);
    return user;
  }

  async getUsers(ids: string[]): Promise<User[]> {
    return Promise.all(ids.map((id) => this.getUser(id)));
  }
}
```

## Best Practices

1. **Always `await` or return** your promises — don't let them float
2. **Use `Promise.all`** for independent parallel operations
3. **Narrow errors** in catch blocks — they're `unknown`
4. **Add timeouts** for external calls in production code
5. **Prefer `async/await`** over chained `.then()` for readability

## Summary

Async/await makes asynchronous TypeScript code clean and readable. Combined with strong typing of Promise return values, you get both clarity and safety. Next, we'll look at concurrent patterns for complex async scenarios.

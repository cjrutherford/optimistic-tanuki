# Promises in TypeScript

TypeScript's type system integrates seamlessly with JavaScript's asynchronous patterns. This lesson covers how to type Promises and handle async operations safely.

## Typing Promises

```typescript
// A Promise that resolves to a string
function fetchGreeting(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve('Hello!'), 1000);
  });
}

// A Promise that might reject
function fetchData(id: string): Promise<User> {
  return fetch(`/api/users/${id}`).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<User>;
  });
}
```

## Promise Chaining

```typescript
interface User { id: string; name: string; teamId: string }
interface Team { id: string; name: string }

function getUser(id: string): Promise<User> { ... }
function getTeam(id: string): Promise<Team> { ... }

// Chaining with full type safety
getUser("alice")
  .then(user => getTeam(user.teamId))   // returns Promise<Team>
  .then(team => console.log(team.name)) // team is Team
  .catch(err => console.error(err))
```

## Promise Combinators

```typescript
// Promise.all — all must succeed
const [user, settings] = await Promise.all([fetchUser('alice'), fetchSettings('alice')]);
// TypeScript infers [User, Settings]

// Promise.allSettled — all results, including failures
const results = await Promise.allSettled([fetchUser('alice'), fetchUser('bob')]);
results.forEach((result) => {
  if (result.status === 'fulfilled') {
    console.log(result.value.name); // User
  } else {
    console.error(result.reason);
  }
});

// Promise.race — first to settle
const fastest = await Promise.race([slow(), fast()]);

// Promise.any — first to succeed
const first = await Promise.any([mayFail1(), mayFail2(), mayFail3()]);
```

## Error Types in Promises

TypeScript doesn't type the rejection value (it's `unknown`):

```typescript
async function riskyFetch(): Promise<Data> {
  try {
    const res = await fetch('/api/data');
    return res.json() as Promise<Data>;
  } catch (err) {
    // err is unknown — you must narrow it
    if (err instanceof Error) {
      throw new Error(`Fetch failed: ${err.message}`);
    }
    throw new Error('Unknown error');
  }
}
```

## Result Pattern

Instead of throwing, return a typed Result:

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

async function safeParseJSON<T>(text: string): Promise<Result<T>> {
  try {
    const value = JSON.parse(text) as T;
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error('Parse failed') };
  }
}

const result = await safeParseJSON<User>('{"name":"Alice"}');
if (result.ok) {
  console.log(result.value.name); // Alice
}
```

## Best Practices

1. **Always specify the type parameter** `Promise<T>` for clarity
2. **Type `catch` errors as `unknown`** and narrow before using
3. **Use the Result pattern** for recoverable errors
4. **Use `Promise.allSettled`** when some failures are acceptable
5. **Avoid floating promises** — always await or handle them

## Summary

TypeScript makes Promises safer by tracking what they resolve to. In the next lesson, we'll look at async/await syntax and more complex error handling patterns.

# Concurrent Patterns

Real applications need to manage multiple async operations efficiently. This lesson covers TypeScript patterns for handling concurrency, queuing, and coordination.

## Promise.all vs Promise.allSettled

```typescript
// Promise.all — fails fast if any rejects
try {
  const [users, posts, comments] = await Promise.all([fetchUsers(), fetchPosts(), fetchComments()]);
  // TypeScript infers [User[], Post[], Comment[]]
} catch (err) {
  // Any single failure lands here
}

// Promise.allSettled — collects all results
const results = await Promise.allSettled([fetchUsers(), fetchPosts()]);
const users = results[0].status === 'fulfilled' ? results[0].value : [];
const posts = results[1].status === 'fulfilled' ? results[1].value : [];
```

## Concurrent Queue

Process items with limited concurrency:

```typescript
async function processWithConcurrency<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

// Process 100 items, 5 at a time
const results = await processWithConcurrency(urls, fetchData, 5);
```

## Retry with Backoff

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts: number = 3, baseDelay: number = 1000): Promise<T> {
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts - 1) {
        await sleep(baseDelay * Math.pow(2, attempt));
      }
    }
  }
  throw lastError;
}

const data = await withRetry(() => fetchUser('alice'), 3, 500);
```

## Debounce and Throttle (Typed)

```typescript
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

const debouncedSearch = debounce((query: string) => search(query), 300);
```

## Event Emitter Pattern

```typescript
type EventMap = {
  'user:login': { userId: string; timestamp: Date };
  'user:logout': { userId: string };
  'order:created': { orderId: string; total: number };
};

class TypedEventEmitter<T extends Record<string, unknown>> {
  private listeners = new Map<keyof T, Set<(data: unknown) => void>>();

  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (data: unknown) => void);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}

const emitter = new TypedEventEmitter<EventMap>();
emitter.on('user:login', ({ userId }) => console.log(userId));
emitter.emit('user:login', { userId: 'alice', timestamp: new Date() });
```

## Best Practices

1. **Limit concurrency** for resource-intensive operations
2. **Add retry logic** for unreliable external calls
3. **Use typed event emitters** for complex event-driven architectures
4. **Always handle errors** in concurrent operations
5. **Profile before optimizing** — parallel isn't always faster

## Summary

Concurrent TypeScript patterns help you write efficient, resilient async code. The type system ensures that coordination between async operations remains type-safe.

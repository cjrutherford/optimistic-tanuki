# Typing React Hooks

Hooks are the heart of modern React. TypeScript integrates with all built-in hooks and custom hooks you write.

## useState

```tsx
import { useState } from 'react';

// TypeScript infers the type from the initial value
const [count, setCount] = useState(0); // number
const [name, setName] = useState(''); // string
const [user, setUser] = useState<User | null>(null); // explicit for complex types
```

## useReducer

```tsx
type Action = { type: 'increment' } | { type: 'decrement' } | { type: 'reset'; payload: number };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case 'increment':
      return state + 1;
    case 'decrement':
      return state - 1;
    case 'reset':
      return action.payload;
  }
}

const [count, dispatch] = useReducer(reducer, 0);
dispatch({ type: 'increment' });
dispatch({ type: 'reset', payload: 10 });
dispatch({ type: 'unknown' }); // ❌ Type error
```

## useContext

```tsx
interface ThemeContextType {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
```

## Custom Hooks

```tsx
function useFetch<T>(url: string): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(url)
      .then((r) => r.json() as Promise<T>)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading, error };
}

// Usage with type parameter
const { data: user, loading } = useFetch<User>('/api/users/1');
```

## Summary

TypeScript makes hooks strongly typed. Custom hooks especially benefit — the return type is inferred and consumers get full type safety.

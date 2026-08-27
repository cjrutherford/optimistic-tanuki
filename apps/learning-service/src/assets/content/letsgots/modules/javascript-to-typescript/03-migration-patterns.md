# Migration Patterns

Migrating a large JavaScript codebase to TypeScript is a well-understood process. Here are the patterns used by major projects (Google, Microsoft, Airbnb) to migrate incrementally without breaking anything.

## The Incremental Migration Checklist

```
1. Add TypeScript and tsconfig.json
2. Enable allowJs and checkJs
3. Rename files one by one: .js → .ts
4. Fix type errors from easiest to hardest
5. Enable stricter options progressively
6. Remove @ts-ignore comments
```

## tsconfig for Migration

Start permissive, tighten over time:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noImplicitAny": false,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

Phase 2 (tighten):

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Pattern: Type Your Data Layer First

The highest value migration target is your data layer — types flow outward from data shapes:

```typescript
// Step 1: Type your domain models
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'shipped' | 'delivered';
}

// Step 2: Type your service layer
async function getUser(id: string): Promise<User | null> {
  const row = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return row ?? null;
}
```

## Pattern: Wrapper Types for Primitives

Brand your primitives to prevent mixing:

```typescript
type UserId = string & { readonly __brand: "UserId" }
type OrderId = string & { readonly __brand: "OrderId" }

function makeUserId(id: string): UserId {
  return id as UserId
}

function getUser(id: UserId): User { ... }

const userId = makeUserId("abc-123")
const orderId = "xyz-456" as OrderId

getUser(userId)   // ✅
getUser(orderId)  // ❌ Type error — prevented mixing IDs
```

## Pattern: Gradual Strictness with `noImplicitAny`

Enable `noImplicitAny` to force explicit types:

```typescript
// Before (implicit any — error with noImplicitAny)
function process(data) {
  return data.value;
}

// After
function process(data: { value: unknown }) {
  return data.value;
}
```

## Pattern: Using `satisfies` for Object Literals

The `satisfies` operator (TypeScript 4.9+) checks types without widening:

```typescript
type Config = Record<string, string | number>;

// ✅ Validates AND preserves literal types
const config = {
  host: 'localhost',
  port: 3000,
} satisfies Config;

// TypeScript knows port is number, not string | number
config.port.toFixed(2); // ✅ Works!
```

## Pattern: Codemods and Automation

For large codebases, use automated tools:

```bash
# ts-migrate by Airbnb
npx @airbnb/ts-migrate migrate ./src

# TypeStat: fixes common TS errors automatically
npx typestat
```

## Pattern: The "Any" Audit

Track your `any` usage and eliminate it over time:

```bash
# Count any usages
grep -r ": any" src/ | wc -l

# Use ESLint rule to prevent new `any`:
# "@typescript-eslint/no-explicit-any": "error"
```

## Pattern: Declaration Merging for Third-Party Extensions

Augment existing types without forking the library:

```typescript
// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session: SessionData;
    }
  }
}
```

## Best Practices

1. **Migrate bottom-up** — utility functions before UI components
2. **Never migrate during a feature sprint** — dedicated migration sprints
3. **Track progress** with coverage metrics (`any` count, strict mode compliance)
4. **Write tests before migrating** — they act as a safety net
5. **Use `// @ts-expect-error` over `// @ts-ignore`** — it errors if the problem is fixed

## Summary

Migration is a journey, not a one-time event. Start with low-hanging fruit, measure progress, and gradually increase strictness. TypeScript pays dividends even before 100% coverage.

# Adding Types to JavaScript

Migrating from JavaScript to TypeScript doesn't have to be scary. You can do it gradually — TypeScript is designed for incremental adoption. This lesson shows you the first steps.

## The `allowJs` Strategy

The easiest migration starts by enabling `allowJs` in your tsconfig:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true, // enables type checking for .js files too
    "strict": false // start lenient, tighten later
  }
}
```

Now you can rename files from `.js` to `.ts` one at a time.

## Annotating Existing Functions

Take a typical JavaScript function:

```javascript
// Before — JavaScript
function fetchUser(id) {
  return fetch(`/api/users/${id}`).then((res) => res.json());
}
```

Add types step by step:

```typescript
// After — TypeScript
interface User {
  id: string;
  name: string;
  email: string;
}

async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json() as User;
}
```

## Dealing with Implicit `any`

When you first migrate, you'll see errors like:

```
Parameter 'x' implicitly has an 'any' type.
```

Fix them by adding explicit types:

```typescript
// Before
function process(data) { ... }      // ❌ implicit any

// After
function process(data: unknown) { ... }  // ✅ explicit unknown
```

## Using `as` for Type Assertions

Sometimes you know more than TypeScript does:

```typescript
const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!; // non-null assertion
```

⚠️ Use type assertions sparingly — they bypass type checking.

## Adding Types to Object Shapes

```javascript
// JavaScript
const config = {
  host: 'localhost',
  port: 3000,
  debug: true,
};
```

```typescript
// TypeScript
interface AppConfig {
  host: string;
  port: number;
  debug: boolean;
}

const config: AppConfig = {
  host: 'localhost',
  port: 3000,
  debug: true,
};
```

## Handling Third-Party Libraries

Many popular libraries have TypeScript types included or available via `@types`:

```bash
# Types included (React, Vue, etc.)
npm install react

# Separate @types package (Node.js, Lodash, etc.)
npm install --save-dev @types/node @types/lodash
```

Check on [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) if types exist.

## The `@ts-ignore` and `@ts-expect-error` Comments

For temporary workarounds during migration:

```typescript
// @ts-ignore — suppress the NEXT LINE's error (use sparingly!)
const result = legacyFunction();

// @ts-expect-error — like ts-ignore but fails if there's no error (preferred)
// @ts-expect-error: TODO migrate this
const value = oldApi.getValue();
```

## Strategy: Start with the Boundaries

Focus type coverage on:

1. **Function signatures** — parameters and return types
2. **API response shapes** — what comes back from the server
3. **Props and state** in UI components
4. **Configuration objects**

You don't need to type every internal variable immediately.

## Best Practices

1. **Don't rush** — migrate file by file
2. **Start with `strict: false`**, then enable strict options one at a time
3. **Use `unknown` instead of `any`** where possible
4. **Add types to function signatures first** — biggest bang for your buck
5. **Use JSDoc as a bridge** — TypeScript understands JSDoc type annotations in `.js` files

## Summary

Adding types to JavaScript is an incremental process. Focus on the most impactful places first — function signatures and data shapes — then gradually expand coverage.

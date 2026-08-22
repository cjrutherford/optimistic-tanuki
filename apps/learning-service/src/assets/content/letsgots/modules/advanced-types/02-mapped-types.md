# Mapped Types and Template Literals

Mapped types let you create new types by transforming the properties of existing types. Template literal types extend this to string manipulation at the type level.

## Mapped Types

A mapped type iterates over the keys of a type and transforms each one:

```typescript
// Make all properties optional
type Partial<T> = {
  [K in keyof T]?: T[K];
};

// Make all properties required
type Required<T> = {
  [K in keyof T]-?: T[K]; // -? removes optionality
};

// Make all properties readonly
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

// Change all value types to string
type Stringify<T> = {
  [K in keyof T]: string;
};
```

## Property Modifiers

You can add or remove `readonly` and `?` modifiers:

```typescript
type Mutable<T> = {
  -readonly [K in keyof T]: T[K]; // remove readonly
};

type Required<T> = {
  [K in keyof T]-?: T[K]; // remove optional
};

type Optional<T> = {
  [K in keyof T]?: T[K]; // add optional
};
```

## Remapping Keys

TypeScript 4.1+ allows remapping keys with `as`:

```typescript
// Add "get" prefix to all property names
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User {
  name: string;
  age: number;
}

type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }
```

## Template Literal Types

Template literal types combine string literals at the type level:

```typescript
type EventName = 'click' | 'focus' | 'blur';
type HandlerName = `on${Capitalize<EventName>}`;
// "onClick" | "onFocus" | "onBlur"

type CSSProperty = 'margin' | 'padding';
type CSSDirectional = `${CSSProperty}-${'top' | 'right' | 'bottom' | 'left'}`;
// "margin-top" | "margin-right" | ... | "padding-left"
```

## Intrinsic String Manipulation Types

TypeScript provides built-in string transformation types:

```typescript
type Upper = Uppercase<'hello'>; // "HELLO"
type Lower = Lowercase<'WORLD'>; // "world"
type Cap = Capitalize<'typescript'>; // "Typescript"
type Uncap = Uncapitalize<'TypeScript'>; // "typeScript"
```

## Practical: Event Handler Map

```typescript
type EventHandlers<T extends Record<string, unknown>> = {
  [K in string & keyof T as `on${Capitalize<K>}Change`]: (value: T[K]) => void;
};

interface FormValues {
  name: string;
  age: number;
  email: string;
}

type FormHandlers = EventHandlers<FormValues>;
// {
//   onNameChange: (value: string) => void
//   onAgeChange: (value: number) => void
//   onEmailChange: (value: string) => void
// }
```

## Practical: Deep Readonly

```typescript
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

interface Config {
  db: {
    host: string;
    port: number;
  };
  app: {
    name: string;
  };
}

const config: DeepReadonly<Config> = {
  db: { host: 'localhost', port: 5432 },
  app: { name: 'MyApp' },
};

config.db.host = 'other'; // ❌ Cannot assign to 'host' — it's readonly
```

## Practical: Type-Safe i18n Keys

```typescript
const translations = {
  'app.title': 'My App',
  'app.description': 'A great app',
  'nav.home': 'Home',
  'nav.about': 'About',
} as const;

type TranslationKey = keyof typeof translations;
// "app.title" | "app.description" | "nav.home" | "nav.about"

function t(key: TranslationKey): string {
  return translations[key];
}

t('app.title'); // ✅ "My App"
t('nav.home'); // ✅ "Home"
t('nav.missing'); // ❌ Type error
```

## Best Practices

1. **Build on built-in utility types** before writing custom mapped types
2. **Use `as` remapping** for complex key transformations
3. **Combine with conditional types** for powerful transformations
4. **Test your types** with `type assertions` to verify they work as expected
5. **Keep it readable** — overly complex mapped types hurt maintainability

## Summary

Mapped types and template literal types bring the power of metaprogramming to TypeScript's type system. They're especially valuable for creating type-safe abstractions over dynamic patterns.

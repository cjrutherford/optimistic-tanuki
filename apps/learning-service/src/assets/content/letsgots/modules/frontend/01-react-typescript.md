# React with TypeScript

React and TypeScript are a natural pair. TypeScript makes your components self-documenting and catches prop errors at compile time.

## Typing Component Props

```tsx
// Inline interface
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: "primary" | "secondary" | "danger"
  disabled?: boolean
}

function Button({ label, onClick, variant = "primary", disabled = false }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {label}
    </button>
  )
}

// Usage — TypeScript checks all props
<Button label="Click me" onClick={() => console.log("clicked")} />
<Button label="Delete" variant="danger" onClick={handleDelete} />
```

## Children Prop

```tsx
import { ReactNode } from 'react';

interface CardProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

function Card({ title, children, footer }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div>{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  );
}
```

## Event Handlers

```tsx
function SearchInput() {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    console.log(event.target.value);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // ...
  }

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleChange} />
    </form>
  );
}
```

## Ref Types

```tsx
import { useRef, useEffect } from 'react';

function AutoFocusInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return <input ref={inputRef} />;
}
```

## Summary

TypeScript makes React components safer and more discoverable. Props are validated at compile time, event handlers are correctly typed, and refactoring is much safer.

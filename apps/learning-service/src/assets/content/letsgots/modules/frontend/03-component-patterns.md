# TypeScript Component Patterns

Advanced React + TypeScript patterns for building scalable, type-safe component libraries.

## Compound Components

```tsx
interface TabsProps {
  children: ReactNode;
  defaultTab: string;
}

const TabsContext = createContext<{ activeTab: string; setActiveTab: (t: string) => void } | null>(null);

function TabsRoot({ children, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div>{children}</div>
    </TabsContext.Provider>
  );
}

function Tab({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('<Tab> must be rendered inside <Tabs>');

  return (
    <button onClick={() => ctx.setActiveTab(id)} aria-selected={ctx.activeTab === id}>
      {children}
    </button>
  );
}

// Object.assign, not `TabsRoot.Tab = Tab`. Assigning a property to a function
// declaration is an error: the function's type has no `Tab` on it, and
// TypeScript will not widen a declared type to accommodate the assignment.
// Object.assign returns an intersection type, so `Tabs.Tab` is known to exist.
export const Tabs = Object.assign(TabsRoot, { Tab });
```

Note the `if (!ctx) throw` rather than a `!` assertion. The non-null assertion
silences the compiler and leaves a `Cannot read properties of null` at runtime
for anyone who renders a `<Tab>` outside its `<Tabs>`. The thrown error says
what they did wrong.

## Generic Components

```tsx
interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={keyExtractor(item)}>{renderItem(item, i)}</li>
      ))}
    </ul>
  );
}

// Fully type-safe usage
<List items={users} keyExtractor={(u) => u.id} renderItem={(u) => <span>{u.name}</span>} />;
```

## Summary

TypeScript patterns like generic components and compound components make React UIs both flexible and type-safe. The type system guides consumers toward correct usage.

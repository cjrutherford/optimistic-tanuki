# TypeScript Component Patterns

Advanced React + TypeScript patterns for building scalable, type-safe component libraries.

## Compound Components

```tsx
interface TabsProps {
  children: ReactNode;
  defaultTab: string;
}

const TabsContext = createContext<{ activeTab: string; setActiveTab: (t: string) => void } | null>(null);

function Tabs({ children, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div>{children}</div>
    </TabsContext.Provider>
  );
}

Tabs.Tab = function Tab({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)!;
  return (
    <button onClick={() => ctx.setActiveTab(id)} aria-selected={ctx.activeTab === id}>
      {children}
    </button>
  );
};
```

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

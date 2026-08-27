# WaitGroup and Mutex

When working with concurrent code, you'll often need to coordinate between goroutines. Go provides several synchronization primitives in the `sync` package.

## sync.WaitGroup

WaitGroup waits for a collection of goroutines to finish.

```go
var wg sync.WaitGroup

wg.Add(1)           // Increment counter
go func() {
    defer wg.Done() // Decrement when done
    // Do work
}()

wg.Wait()           // Block until counter is 0
```

### Example: Parallel Processing

```go
func processItems(items []int) []int {
    var wg sync.WaitGroup
    results := make([]int, len(items))

    for i, item := range items {
        wg.Add(1)
        go func(index, value int) {
            defer wg.Done()
            results[index] = value * 2
        }(i, item)
    }

    wg.Wait()
    return results
}
```

## sync.Mutex

A mutual exclusion lock. Use it to protect shared resources.

```go
type Counter struct {
    mu    sync.Mutex
    value int
}

func (c *Counter) Increment() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.value++
}

func (c *Counter) Value() int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.value
}
```

### Common Mistakes

```go
// WRONG - forgot to unlock on early return
func (c *Counter) BadIncrement() {
    c.mu.Lock()
    if c.value >= 100 {
        return // Forgot to unlock!
    }
    c.value++
    c.mu.Unlock()
}

// RIGHT - use defer
func (c *Counter) GoodIncrement() {
    c.mu.Lock()
    defer c.mu.Unlock()
    if c.value >= 100 {
        return
    }
    c.value++
}
```

## RWMutex

Multiple readers, single writer:

```go
type Cache struct {
    mu    sync.RWMutex
    data  map[string]string
}

func (c *Cache) Get(key string) string {
    c.mu.RLock()
    defer c.mu.RUnlock()
    return c.data[key]
}

func (c *Cache) Set(key, value string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.data[key] = value
}
```

## Best Practices

1. **Keep critical sections small** - Lock for as little time as possible
2. **Never lock inside a lock** - Avoid deadlock
3. **Use defer** - Always unlock in defer
4. **Consider channels** - Sometimes easier than mutex

## Code Playground

Try the WaitGroup and Mutex examples!

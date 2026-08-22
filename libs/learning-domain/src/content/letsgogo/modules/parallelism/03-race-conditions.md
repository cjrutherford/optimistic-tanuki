# Race Conditions

A race condition occurs when multiple goroutines access and modify shared data concurrently, and the outcome depends on the timing.

## Detecting Races

Use the race detector:

```bash
go run -race main.go
go test -race ./...
```

This instruments your code to detect races at runtime.

## Example: The Problem

```go
var counter int

func increment() {
    // This is NOT thread-safe!
    temp := counter
    temp++
    counter = temp
}

func main() {
    for i := 0; i < 1000; i++ {
        go increment()
    }
    time.Sleep(time.Second)
    fmt.Println(counter) // Likely not 1000!
}
```

## Fix 1: Mutex

```go
var (
    counter int
    mu      sync.Mutex
)

func increment() {
    mu.Lock()
    defer mu.Unlock()
    counter++
}
```

## Fix 2: Atomic

```go
var counter int64

func increment() {
    atomic.AddInt64(&counter, 1)
}
```

## Fix 3: Channels

```go
func main() {
    counter := 0
    ch := make(chan func(), 100)

    // Start worker
    go func() {
        for f := range ch {
            f()
        }
    }()

    // Send work
    for i := 0; i < 1000; i++ {
        ch <- func() { counter++ }
    }
    close(ch)
    time.Sleep(time.Second)
    fmt.Println(counter)
}
```

## Common Patterns to Avoid

### 1. Sharing via Closure

```go
// WRONG
for i := 0; i < 10; i++ {
    go func() {
        fmt.Println(i) // All goroutines see i = 10!
    }()
}

// RIGHT
for i := 0; i < 10; i++ {
    go func(i int) {
        fmt.Println(i)
    }(i)
}
```

### 2. Partial Synchronization

```go
// WRONG - some state not protected
type Stats struct {
    mu       sync.Mutex
    Count    int // Protected
    LastSeen int // NOT protected!
}
```

### 3. Returning Pointers

```go
// DANGEROUS - pointer escapes and can be accessed
func getPointer() *int {
    i := 42
    return &i // i escapes to heap!
}
```

## Best Practices

1. **Always run with `-race`** in development
2. **Prefer channels** for sharing data
3. **Use mutex** when protecting state
4. **Keep critical sections small**
5. **Document thread-safety**

## Code Playground

Try the race condition examples with -race!

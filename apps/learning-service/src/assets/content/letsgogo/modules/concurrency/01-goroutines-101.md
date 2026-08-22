# Goroutines 101

Goroutines are lightweight threads managed by the Go runtime. They're the foundation of concurrent programming in Go.

## Starting a Goroutine

```go
func sayHello(name string) {
    fmt.Println("Hello,", name)
}

// Normal function call - runs synchronously
sayHello("World")

// Goroutine - runs asynchronously
go sayHello("World")
```

## The Go Scheduler

Unlike OS threads (expensive, ~1-8MB stack each), goroutines are:

- Lightweight (~2KB stack initially)
- Managed by Go runtime (not OS)
- Multiplexed onto OS threads
- Millions can run simultaneously

```go
// Launch 1 million goroutines!
for i := 0; i < 1_000_000; i++ {
    go func(i int) {
        // Do something
    }(i)
}
```

## Basic Example

```go
func main() {
    go say("Hello")
    go say("World")
    go say("!")

    time.Sleep(time.Second) // Wait for goroutines
}

func say(msg string) {
    for i := 0; i < 3; i++ {
        fmt.Println(msg)
        time.Sleep(100 * time.Millisecond)
    }
}
```

## Waiting for Goroutines

Don't use `time.Sleep` in production! Use synchronization primitives:

### Using sync.WaitGroup

```go
func main() {
    var wg sync.WaitGroup
    words := []string{"Hello", "World", "!"}

    for _, word := range words {
        wg.Add(1) // Increment counter
        go func(w string) {
            defer wg.Done() // Decrement when done
            fmt.Println(w)
        }(word)
    }

    wg.Wait() // Block until counter is 0
}
```

## Anonymous Goroutines

```go
go func() {
    fmt.Println("Running in background")
}()
```

With parameters:

```go
go func(name string, age int) {
    fmt.Printf("%s is %d years old\n", name, age)
}("Alice", 30)
```

## Goroutines and Closures

**Important**: Be careful with closures capturing loop variables!

```go
// WRONG - all goroutines capture same variable
for i := 0; i < 3; i++ {
    go func() {
        fmt.Println(i) // All print 3!
    }()
}

// RIGHT - pass as parameter
for i := 0; i < 3; i++ {
    go func(n int) {
        fmt.Println(n) // Prints 0, 1, 2
    }(i)
}

// Also RIGHT - create new variable
for i := 0; i < 3; i++ {
    i := i // Create new variable
    go func() {
        fmt.Println(i)
    }()
}
```

## Goroutine Leaks

A goroutine that never completes (leak):

```go
func leaky() {
    ch := make(chan int)
    go func() {
        ch <- 1 // Blocks forever if no receiver!
    }()
}

// Better - use context or buffer
func notLeaky(ctx context.Context) {
    ch := make(chan int, 1) // Buffered
    go func() {
        select {
        case ch <- 1:
        case <-ctx.Done():
        }
    }()
}
```

## When to Use Goroutines

- **I/O operations** - HTTP requests, file I/O, database queries
- **Background tasks** - logging, metrics, heartbeat
- **Parallel computation** - processing chunks of data
- **Multiple services** - handling multiple requests

## Best Practices

1. **Always know when goroutines complete** - use WaitGroup, channels, or context
2. **Don't leak goroutines** - ensure they can exit
3. **Pass values, not pointers** unless necessary
4. **Keep it simple** - don't over-concurrentize

## Code Playground

Launch goroutines and see how they execute!

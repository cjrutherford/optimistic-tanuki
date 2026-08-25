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

A goroutine started inside a loop captures the loop variable. What that
means changed in Go 1.22, and which Go you are reading matters.

```go
for i := 0; i < 3; i++ {
    go func() {
        fmt.Println(i)
    }()
}
```

**Go 1.22 and later**, which includes every supported version: each iteration
declares its own `i`, so each goroutine captures a different one and this
prints 0, 1 and 2 in some order. It is correct.

**Go 1.21 and earlier**: all three iterations shared one `i`, so all three
goroutines saw whatever it held when they ran, which was usually 3 after the
loop finished. This was the single most reported Go bug, and it is why so much
older code and so many older tutorials carry the workarounds:

```go
// The old fixes. Both still work and neither is needed any more.
for i := 0; i < 3; i++ {
    go func(n int) { fmt.Println(n) }(i)   // pass it as an argument
}

for i := 0; i < 3; i++ {
    i := i                                  // or shadow it
    go func() { fmt.Println(i) }()
}
```

The version your module targets is what decides this, not the compiler you
happen to be running. The `go` line in `go.mod` selects the semantics, so a
module saying `go 1.21` keeps the old behaviour even on a new toolchain. If
you inherit code with `i := i` at the top of a loop body, that is where it came
from.

What did **not** change is the underlying rule: a closure captures variables,
not values. That still matters everywhere else.

```go
counter := 0
go func() {
    counter++   // the same counter main can see, and a data race
}()
```

Go 1.22 gave loops a fresh variable per iteration. It did not make captured
variables safe to share, which is what the parallelism module is about.

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

# Defer, Panic, Recover

Go has a unique approach to error handling and control flow. Unlike try-catch, Go uses defer, panic, and recover for special cases.

## Defer

`defer` schedules a function call to run after the surrounding function completes. It's commonly used for cleanup.

### Basic Usage

```go
func readFile(name string) {
    file, err := os.Open(name)
    if err != nil {
        fmt.Println(err)
        return
    }

    // This runs when readFile returns!
    defer file.Close()

    // Do stuff with file...
}
```

### Why Defer?

In TypeScript with async/await:

```typescript
async function readFile(name: string) {
  const file = await fs.open(name);
  try {
    // Do stuff
  } finally {
    await file.close(); // Cleanup
  }
}
```

In Go with defer:

```go
func readFile(name string) {
    file, err := os.Open(name)
    if err != nil {
        return
    }
    defer file.Close() // Runs when function returns

    // Do stuff...
}
```

### Multiple Defers

```go
func example() {
    defer fmt.Println("1")
    defer fmt.Println("2")
    defer fmt.Println("3")

    fmt.Println("main")
}
// Output: main, 3, 2, 1
// Defers run in LIFO order!
```

### Capturing Values

```go
func demo() {
    i := 0
    defer func() {
        fmt.Println(i) // Prints 10, not 0!
    }()
    i = 10
}

// To capture current value:
defer func(i int) {
    fmt.Println(i)
}(i) // Pass as argument
```

## Panic

`panic` stops normal execution and starts unwinding the stack.

```go
func divide(a, b float64) float64 {
    if b == 0 {
        panic("division by zero")
    }
    return a / b
}
```

When panic occurs:

1. Current function stops
2. Defers run
3. Calling function stops
4. Its defers run
5. ... continues up the stack

### Recover

`recover` catches a panic and lets the program continue:

```go
func safeCall(fn func()) (err error) {
    defer func() {
        if r := recover(); r != nil {
            err = fmt.Errorf("panic: %v", r)
        }
    }()
    fn()
    return nil
}
```

### Practical Pattern

```go
func handlePanic() {
    if r := recover(); r != nil {
        fmt.Println("Recovered:", r)
    }
}

func risky() {
    defer handlePanic()
    panic("something went wrong")
}
```

## When to Use Each

### Use Defer For:

- File/connection closing
- Mutex unlocking
- Timing measurements
- Cleanup operations

### Avoid Panic For:

- Normal error handling (return error instead!)
- Expected failure cases

### Use Panic Only For:

- Truly unrecoverable errors
- Programming mistakes (e.g., nil pointer check during development)

## Real-World Example

```go
func startServer() error {
    listener, err := net.Listen("tcp", ":8080")
    if err != nil {
        return err
    }

    defer listener.Close()

    // Register cleanup
    defer func() {
        fmt.Println("Shutting down server...")
    }()

    // This could panic
    http.Handle("/", handler)

    return http.Serve(listener, nil)
}
```

## Common Mistakes

```go
// WRONG - defer catches nothing
defer recover() // Won't work!

// RIGHT - defer a function that calls recover
defer func() {
    if r := recover(); r != nil {
        // Handle panic
    }
}()
```

## Code Playground

Experiment with defer, panic, and recover to understand the control flow!

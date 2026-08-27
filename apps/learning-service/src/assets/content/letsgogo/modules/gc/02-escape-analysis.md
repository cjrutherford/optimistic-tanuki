# Escape Analysis

Escape analysis determines whether a variable can be allocated on the stack or must escape to the heap.

## Stack vs Heap

### Stack Allocation (Fast)

- Deallocated when function returns
- No garbage collection needed

### Heap Allocation (Slower)

- Persists until GC
- Adds GC pressure

## How Go Decides

```go
func main() {
    x := 42      // Stays on stack
    p := &x      // Escapes to heap!
    fmt.Println(*p)
}
```

### Rules

1. **Returning a pointer** → escapes
2. **Sending pointer to channel** → escapes
3. **Slicing with pointer inside** → might escape
4. **Local variable too large** → escapes

## Examples

### Not Escaping

```go
func add(a, b int) int {
    return a + b
}
```

### Escaping

```go
func newUser() *User {
    user := User{Name: "Alice"} // Escapes!
    return &user               // Returns pointer
}
```

### Checking

```bash
go build -gcflags="-m" main.go
```

Output:

```
main.go:10:6: moved to heap: user
main.go:9:10: newUser new(User) does not escape
```

## Performance Impact

```go
// Slower - heap allocation
func createUsers(n int) []*User {
    users := make([]*User, n)
    for i := 0; i < n; i++ {
        users[i] = &User{Name: "test"}
    }
    return users
}

// Faster - stack + escape at return
func createUsers(n int) []User {
    users := make([]User, n)
    for i := 0; i < n; i++ {
        users[i] = User{Name: "test"}
    }
    return users
}
```

## sync.Pool

Reuse objects to reduce allocations:

```go
var bufferPool = sync.Pool{
    New: func() interface{} {
        return new(bytes.Buffer)
    },
}

func process() {
    buf := bufferPool.Get().(*bytes.Buffer)
    defer bufferPool.Put(buf)

    buf.Reset()
    // Use buffer
}
```

## Best Practices

1. **Don't optimize prematurely** - measure first
2. **Let Go decide** - trust the compiler
3. **Use sync.Pool** for frequently allocated objects
4. **Check with -gcflags="-m"** to understand escapes

## Code Playground

See how escape analysis works!

# Writing GC-Friendly Code

Tips for writing code that works well with Go's garbage collector.

## Reduce Allocations

### Pre-allocate Slices

```go
// BAD - multiple allocations
func build(n int) []int {
    var result []int
    for i := 0; i < n; i++ {
        result = append(result, i)
    }
    return result
}

// GOOD - single allocation
func build(n int) []int {
    result := make([]int, n)
    for i := 0; i < n; i++ {
        result[i] = i
    }
    return result
}
```

### Reuse Buffers

```go
// BAD - new buffer each time
func process(data []byte) string {
    return base64.StdEncoding.EncodeToString(data)
}

// GOOD - reuse with sync.Pool
var encoderPool = sync.Pool{
    New: func() interface{} {
        return base64.NewEncoder(base64.StdEncoding, &bytes.Buffer{})
    },
}

func process(data []byte) string {
    enc := encoderPool.Get().(*base64.Encoder)
    defer encoderPool.Put(enc)

    buf := &bytes.Buffer{}
    enc.Reset(buf)
    enc.Write(data)
    enc.Close()
    return buf.String()
}
```

## Use Values for Small Data

```go
// For small structs, use values
type Point struct {
    X, Y int
}

// Passing by value is often faster
func distance(a, b Point) int {
    dx := a.X - b.X
    dy := a.Y - b.Y
    return dx*dx + dy*dy
}
```

## Avoid Strings and []byte Conversions

```go
// BAD - creates new string
s := string(b)

// GOOD - use string directly
func process(b []byte) {
    // Use as []byte
    _ = hex.EncodeToString(b)
}
```

## Use Finalizers Sparingly

```go
// Avoid - adds GC overhead
runtime.SetFinalizer(obj, func(obj *MyType) {
    // Cleanup
})
```

## Monitor GC

```go
import "runtime/debug"

func main() {
    // Print GC stats
    debug.FreeOSMemory()

    var stats debug.GCStats
    debug.ReadGCStats(&stats)
    fmt.Printf("Last GC: %v\n", stats.LastGC)
    fmt.Printf("Number of GCs: %d\n", stats.NumGC)
}
```

### GOGC Environment

```bash
# More aggressive collection
GOGC=50

# Less aggressive (more memory)
GOGC=200
```

## Profiling Memory

```bash
go test -bench=. -benchmem -memprofile=mem.out
go tool pprof mem.out
```

## Best Practices

1. **Pre-allocate slices** with make
2. **Reuse buffers** with sync.Pool
3. **Use values** for small data
4. **Avoid string/[]byte** conversions
5. **Profile before optimizing**

## Code Playground

Optimize memory allocation!

# How Go's GC Works

Go has an automatic garbage collector that manages memory for you. Understanding how it works helps you write more efficient code.

## The Basics

Go's garbage collector has evolved:

- **Go 1.0**: Mark-sweep (stop-the-world)
- **Go 1.5**: Concurrent mark-sweep
- **Go 1.8**: Tri-color mark-sweep with sub-millisecond pauses
- **Go 1.19**: `GOMEMLIMIT`, a soft memory limit the collector works to stay under

That last one is the change most worth knowing about. The algorithm has been
concurrent tri-color mark-sweep since 1.8 and has not been replaced since;
what has improved is the tuning you get over it.

## The Tri-Color Algorithm

1. **White set**: Potentially garbage
2. **Gray set**: Visited, needs scanning
3. **Black set**: Visited and fully scanned (reachable)

### Process:

```
1. Start: All objects white, roots gray
2. Gray: Scan object, mark all referenced objects gray
3. Move gray to black when done
4. Repeat until no gray objects
5. White objects = garbage, collect them
```

## Phases of GC

1. **Mark Start**: Stop-the-world, mark roots
2. **Mark**: Concurrent, marking reachable objects
3. **Mark Termination**: Stop-the-world, finish marking
4. **Sweep**: Concurrent, reclaim unmarked memory

## GC in Action

```go
func main() {
    // GC runs automatically
    // Trigger manually:
    runtime.GC()

    // Get GC stats
    debug.FreeOSMemory()

    var stats debug.GCStats
    debug.ReadGCStats(&stats)
    fmt.Printf("Last GC: %v, NumGC: %d\n", stats.LastGC, stats.NumGC)
}
```

## Tuning GC

### GOGC

Controls memory growth between GCs. Default is 100 (double heap size before GC):

```bash
# More aggressive GC (less memory)
GOGC=50

# Less aggressive (more memory)
GOGC=200
```

### GODEBUG

```bash
# Print a line to stderr on every collection
GODEBUG=gctrace=1

# Turn the collector off entirely (for measurement, never in production)
GOGC=off

# Cap the heap instead of turning collection off. Go 1.19 and later.
GOMEMLIMIT=512MiB
```

`gctrace` only reports; it never changes when collection happens. Turning the
collector off is `GOGC=off`, and a process that does that will grow until it
is killed.

## Memory Management

### Allocation

```go
// Small allocations (< 32KB): from local caches
// Large allocations: from heap directly

// Where a value lives is decided by escape analysis, not by how it is
// declared. This buffer is a local value and stays on the stack, unless it
// escapes -- by being returned, stored in a global, or captured by a
// goroutine that outlives the call.
var buf bytes.Buffer

// Ask the compiler rather than guessing:
//   go build -gcflags='-m' ./...
```

### Stack vs Heap

```go
func add(a, b int) int {
    // a, b on stack (if optimized)
    return a + b
}

func newUser() *User {
    // User on heap - escapes!
    return &User{Name: "Alice"}
}
```

## Code That Triggers GC

```go
// BAD: Many allocations
func process(items []int) []int {
    results := []int{}
    for _, item := range items {
        results = append(results, item * 2) // New slice each time!
    }
    return results
}

// GOOD: Pre-allocate
func process(items []int) []int {
    results := make([]int, len(items))
    for i, item := range items {
        results[i] = item * 2
    }
    return results
}
```

## Best Practices

1. **Reduce allocations**: Pre-allocate slices with `make`
2. **Reuse buffers**: Use `sync.Pool`
3. **Avoid pointers when unnecessary**: Values can stay on stack
4. **Use strings carefully**: Converting []byte to string copies
5. **Profile first**: Don't optimize until you have data

## Viewing GC Info

```bash
# Run with GC tracing
go run -gcflags="-m=2" main.go 2>&1 | grep -i heap

# Runtime metrics
go tool pprof http://localhost:6060/debug/pprof/heap
```

## Code Playground

Watch how GC behaves with different code patterns!

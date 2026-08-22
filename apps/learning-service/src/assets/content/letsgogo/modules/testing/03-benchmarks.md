# Benchmarks

Go includes built-in benchmarking. Benchmark functions start with `Benchmark` and are run with `go test -bench`.

## Writing Benchmarks

```go
func BenchmarkAdd(b *testing.B) {
    var result int
    b.ResetTimer()

    for i := 0; i < b.N; i++ {
        result = i + i
    }

    _ = result
}
```

Run with:

```bash
go test -bench=.
go test -bench=BenchmarkAdd
```

## Benchmark Output

```
goos: darwin
goarch: arm64
pkg: mypackage
cpu: Apple M1
BenchmarkAdd-8    1000000000           0.3043 ns/op
PASS
ok      mypackage    0.543s
```

- `BenchmarkAdd-8`: Running on 8 CPUs
- `1000000000`: b.N (iterations)
- `0.3043 ns/op`: Time per operation

## Comparing Implementations

```go
func BenchmarkSquare(b *testing.B) {
    for i := 0; i < b.N; i++ {
        _ = i * i
    }
}

func BenchmarkMultiply(b *testing.B) {
    for i := 0; i < b.N; i++ {
        _ = i * 2
    }
}

func BenchmarkShift(b *testing.B) {
    for i := 0; i < b.N; i++ {
        _ = i << 1
    }
}
```

```bash
go test -bench=.
```

## Measuring Memory

```go
func BenchmarkAllocate(b *testing.B) {
    b.ReportAllocs()

    for i := 0; i < b.N; i++ {
        _ = make([]int, 1000)
    }
}
```

Output:

```
BenchmarkAllocate-8    123456    9523 ns/op    8000 B/op    99 allocs/op
```

## Subtests in Benchmarks

```go
func BenchmarkStringOps(b *testing.B) {
    tests := []struct {
        name string
        size int
    }{
        {"small", 10},
        {"medium", 1000},
        {"large", 100000},
    }

    for _, tt := range tests {
        b.Run(tt.name, func(b *testing.B) {
            for i := 0; i < b.N; i++ {
                s := strings.Repeat("a", tt.size)
                _ = strings.ToUpper(s)
            }
        })
    }
}
```

## Timing Control

```go
func BenchmarkExpensive(b *testing.B) {
    // Skip in short mode
    if testing.Short() {
        b.Skip("Skipping in short mode")
    }

    // Parallel benchmark
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            // Do work
        }
    })
}
```

## Common Patterns

### 1. Precomputing

```go
func BenchmarkConcat(b *testing.B) {
    items := make([]string, 1000)
    for i := range items {
        items[i] = "item"
    }

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _ = strings.Join(items, ",")
    }
}
```

### 2. Caching

```go
func BenchmarkCacheHit(b *testing.B) {
    cache := NewCache()

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            _, _ = cache.Get("key")
        }
    })
}
```

## Profiling Benchmarks

```bash
# CPU profile
go test -bench=. -cpuprofile=cpu.prof
go tool pprof cpu.prof

# Memory profile
go test -bench=. -memprofile=mem.prof
go tool pprof mem.prof

# Block profile (for synchronization)
go test -bench=. -blockprofile=block.prof
```

## Code Playground

Try writing benchmarks for the code examples!

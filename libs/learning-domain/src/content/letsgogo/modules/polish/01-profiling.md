# Profiling

Go includes powerful profiling tools to understand your program's performance.

## pprof

```bash
go tool pprof http://localhost:6060/debug/pprof/profile
```

### Enable Profiling

```go
import (
    "net/http"
    _ "net/http/pprof"
)

func main() {
    go func() {
        http.ListenAndServe("localhost:6060", nil)
    }()

    // Your app
}
```

## CPU Profiling

```bash
# 30 second profile
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/profile

# From file
go tool pprof -http=:8080 cpu.prof
```

```go
import "runtime/pprof"

func main() {
    f, _ := os.Create("cpu.prof")
    pprof.StartCPUProfile(f)
    defer pprof.StopCPUProfile()

    // Your code
}
```

## Memory Profiling

```bash
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/heap
```

```go
import "runtime/pprof"

func main() {
    f, _ := os.Create("mem.prof")
    pprof.WriteHeapProfile(f)
    f.Close()
}
```

## Viewing Profiles

### Web UI

```bash
go tool pprof -http=:8080 profile.prof
```

### Commands in pprof

```
top          // Top functions
list func    // Source for function
web         // Generate SVG graph
```

## Benchmark Profiling

```bash
# CPU
go test -bench=. -cpuprofile=cpu.prof
go tool pprof cpu.prof

# Memory
go test -bench=. -memprofile=mem.prof
go tool pprof mem.prof
```

## Trace

```bash
go tool trace trace.out
```

```go
import "runtime/trace"

func main() {
    f, _ := os.Create("trace.out")
    trace.Start(f)
    defer trace.Stop()

    // Your code
}
```

## Common Issues

### 1. Memory Growth

```
Look for: increasing heap allocations
Fix: Reduce allocations, use sync.Pool
```

### 2. CPU Usage

```
Look for: hot functions
Fix: Optimize algorithms, use caching
```

### 3. Blocking

```
Look for: goroutine blocking
Fix: Use channels, sync primitives
```

## Code Playground

Profile your code to find bottlenecks!

# sync/atomic

The `sync/atomic` package provides low-level atomic operations for lock-free synchronization.

## When to Use Atomic

- Simple counters
- Flags
- Single values that need atomic updates

## Basic Operations

```go
import "sync/atomic"

var counter int64

// Add
atomic.AddInt64(&counter, 1)

// Load
value := atomic.LoadInt64(&counter)

// Store
atomic.StoreInt64(&counter, 100)

// Compare and Swap
atomic.CompareAndSwapInt64(&counter, old, new)
```

## Example: Counter

```go
type Counter struct {
    value int64
}

func (c *Counter) Increment() {
    atomic.AddInt64(&c.value, 1)
}

func (c *Counter) Value() int64 {
    return atomic.LoadInt64(&c.value)
}
```

## Atomic with Pointers

```go
var ptr *int

// Store pointer atomically
atomic.StorePointer((*unsafe.Pointer)(unsafe.Pointer(&ptr)), unsafe.Pointer(newValue))

// Load pointer atomically
old := atomic.LoadPointer((*unsafe.Pointer)(unsafe.Pointer(&ptr)))
```

## Use Cases

### 1. Simple Statistics

```go
type Stats struct {
    successCount int64
    failureCount int64
}

func (s *Stats) RecordSuccess() {
    atomic.AddInt64(&s.successCount, 1)
}

func (s *Stats) RecordFailure() {
    atomic.AddInt64(&s.failureCount, 1)
}

func (s *Stats) Get() (success, failure int64) {
    return atomic.LoadInt64(&s.successCount),
           atomic.LoadInt64(&s.failureCount)
}
```

### 2. Flag

```go
var running int64

func Start() {
    atomic.StoreInt64(&running, 1)
}

func Stop() {
    atomic.StoreInt64(&running, 0)
}

func IsRunning() bool {
    return atomic.LoadInt64(&running) == 1
}
```

## Atomic vs Mutex

| Operation       | Atomic | Mutex  |
| --------------- | ------ | ------ |
| Single value    | ✅     | ✅     |
| Multiple values | ❌     | ✅     |
| Performance     | Faster | Slower |
| Complexity      | Lower  | Higher |

## Code Playground

Experiment with atomic operations!

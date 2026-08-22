# Slices, Arrays, and Maps

If you've worked with JavaScript/TypeScript arrays, Go's collection types will require some adjustment. Let's explore the differences.

## Arrays

Fixed-size, value type in Go:

```go
// Fixed size - [3]int is different from [4]int
var arr [3]int = [3]int{1, 2, 3}

// Or with ellipsis - size inferred
arr := [...]int{1, 2, 3}

// Array passed by VALUE (copy!)
func printArray(arr [3]int) {
    fmt.Println(arr) // Prints copy
}
```

## Slices

Dynamic, reference type - what you use most often:

```go
// Empty slice
var sl []int

// With initialization
sl := []int{1, 2, 3}

// Using make
sl := make([]int, 0, 10) // length 0, capacity 10

// From array
arr := [5]int{1, 2, 3, 4, 5}
sl := arr[1:4] // [2, 3, 4] - slice of array
```

### Slice Internals

A slice is a struct with three fields:

```go
type sliceHeader struct {
    Data uintptr  // Pointer to underlying array
    Len  int      // Current length
    Cap  int      // Capacity before reallocation
}
```

This is why slices are passed by reference!

### Appending

```go
sl := []int{1, 2, 3}
sl = append(sl, 4) // Returns new slice!

// Pre-allocate for performance
sl := make([]int, 0, 1000)
for i := 0; i < 1000; i++ {
    sl = append(sl, i)
}
```

### Slicing

```go
sl := []int{1, 2, 3, 4, 5}

sl[1:3]   // [2, 3] - slice
sl[:3]    // [1, 2, 3] - from start
sl[2:]    // [3, 4, 5] - to end
sl[:]     // [1, 2, 3, 4, 5] - full slice
```

### Common Operations

```go
// Copy
copy(dst, src)

// Delete element at index i
append(sl[:i], sl[i+1:]...)

// Insert
append(sl[:i], append([]int{x}, sl[i:]...)...)
```

## Maps

Key-value store, reference type:

```go
// Declaration
var m map[string]int

// Initialize before use!
m = make(map[string]int)

// Or with initial values
m := map[string]int{
    "a": 1,
    "b": 2,
}
```

### Map Operations

```go
// Set
m["key"] = 42

// Get (two-value form)
value, ok := m["key"]
if !ok {
    // Key doesn't exist
}

// Delete
delete(m, "key")

// Iterate
for key, value := range m {
    fmt.Println(key, value)
}
```

### Map Internals

Maps are hash tables. The zero value is `nil`:

```go
var m map[string]int
m["key"] = 1 // PANIC! Nil map assignment

// Always initialize
m := make(map[string]int)
```

## Comparison with TypeScript

| TypeScript    | Go             |
| ------------- | -------------- |
| `Array<T>`    | `[]T` (slice)  |
| `T[]` (fixed) | `[n]T` (array) |
| `Map<K, V>`   | `map[K]V`      |
| `Object`      | `struct`       |

## Performance Tips

1. **Pre-allocate slices** with `make([]T, 0, capacity)`
2. **Use maps for lookups**, not linear search
3. **Avoid growing slices in loops** - pre-allocate
4. **Reuse buffers** with `make([]T, 0, 1024)` and `clear()`

## Common Gotchas

```go
// 1. Slice reference trap
a := []int{1, 2, 3}
b := a  // b is NOT a copy! Both share underlying array
b[0] = 99
fmt.Println(a[0]) // 99!

// Real copy:
b := make([]int, len(a))
copy(b, a)

// 2. Map iteration order is random
for k, v := range m {
    // Order changes every run!
}

// 3. Can't compare slices or maps
// This doesn't compile!
_ = []int{1} == []int{1} // ERROR

// Use reflect.DeepEqual or custom comparison
```

## Code Playground

Try creating slices, arrays, and maps to understand their behavior!

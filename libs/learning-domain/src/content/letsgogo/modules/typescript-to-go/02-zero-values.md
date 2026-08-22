# Zero Values

One of Go's most distinctive features is its approach to uninitialized variables. Unlike TypeScript where variables can be `undefined` or `null`, Go guarantees every variable has a zero value.

## The Zero Values

Every type in Go has a zero value:

| Type                 | Zero Value        |
| -------------------- | ----------------- |
| numbers (int, float) | 0                 |
| booleans             | false             |
| strings              | "" (empty string) |
| pointers             | nil               |
| slices               | nil               |
| maps                 | nil               |
| channels             | nil               |
| interfaces           | nil               |
| functions            | nil               |

## Examples

```go
var i int          // 0
var f float64      // 0.0
var b bool         // false
var s string       // ""
var p *int         // nil
var arr [5]int     // [0 0 0 0 0]
var sl []int       // nil (not []!)
var m map[string]int // nil
```

## Why This Matters

### No undefined/null Checks

In TypeScript:

```typescript
function greet(name?: string) {
  if (name === undefined) {
    return 'Hello, stranger!';
  }
  return `Hello, ${name}!`;
}
```

In Go, you don't need to check for nil (for pointers/interfaces):

```go
func greet(name *string) string {
    if name == nil {
        return "Hello, stranger!"
    }
    return fmt.Sprintf("Hello, %s!", *name)
}
```

### Empty Slices vs Nil Slices

TypeScript:

```typescript
let arr: string[] = []; // Empty array
let arr2: string[] | undefined; // undefined
```

Go:

```go
var sl []string // nil slice - safe to append!
sl = append(sl, "hello") // Works perfectly

var sl2 []string = []string{} // Empty slice - also works
```

Both are valid, but nil slices are more efficient (no allocation).

## The Zero Value Trap

Be careful with zero values for slices and maps:

```go
var m map[string]int
m["key"] = 1 // PANIC! Assignment to nil map

// Fix:
m := make(map[string]int)
m["key"] = 1 // Works
```

## Best Practices

1. **Use pointers for optional values** - `*string` is the Go equivalent of `string | undefined`
2. **Check for nil before using** - especially for slices, maps, channels, and interfaces
3. **Initialize maps and slices** - use `make()` for maps and `[]T{}` or `make([]T, 0)` for slices
4. **Use the comma-ok idiom** for map lookups:

```go
value, ok := m["key"]
if !ok {
    // key doesn't exist
}
```

## Code Playground

Try creating different types and see their zero values!

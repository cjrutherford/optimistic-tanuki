# Variables & Types

Go has a **static type system** with powerful type inference. This means every variable has a specific type that's known at compile time, giving you type safety while keeping code concise.

---

## Declaring Variables

Go offers three primary ways to declare variables. Each has its use case.

### 1. Explicit Declaration with `var`

```go
var name string = "Alice"
var age int = 30
var isActive bool = true
var price float64 = 19.99
```

**When to use:**

- Package-level variables (outside functions)
- When you want to declare first, assign later
- When explicit type documentation improves readability

```go
var name string  // Declared but not initialized → zero value
name = "Alice"   // Assigned later
```

### 2. Type Inference

Go can automatically determine the type from the value:

```go
var name = "Alice"    // Go infers: string
var age = 30          // Go infers: int
var isActive = true   // Go infers: bool
var price = 19.99     // Go infers: float64
```

**How Go infers types:**

- `"Alice"` → `string`
- `30` → `int`
- `true`/`false` → `bool`
- `3.14` → `float64`

### 3. Short Declaration (`:=`)

The **most common** way to declare variables inside functions:

```go
func main() {
    name := "Alice"    // string
    age := 30          // int
    isActive := true   // bool
}
```

**Key characteristics:**

- Can only be used **inside functions**
- Creates and initializes in one step
- Cannot change the type later
- `:=` declares, `=` assigns to existing

```go
x := 5      // Declare and initialize
x = 10      // Assign new value (OK)
x := 10     // ERROR: cannot redeclare x in same scope
x, y := 5, 10  // Multiple at once
```

---

## Deep Dive: Basic Types

### Numbers

Go provides several numeric types for different use cases:

**Integers (signed):**

```go
int   // Platform-dependent (32 or 64 bits)
int8  // -128 to 127
int16 // -32,768 to 32,767
int32 // -2.1B to 2.1B
int64 // Very large numbers
```

**Integers (unsigned - positive only):**

```go
uint   // Platform-dependent
uint8  // 0 to 255
uint16 // 0 to 65,535
uint32 // 0 to 4.2B
uint64 // Very large numbers
```

**Practical guidance:**

- Use `int` for most integer operations
- Use `uint` only when you need only positive values
- Use specific sizes (`int32`, `int64`) for:
  - Binary protocols
  - File formats
  - Cross-platform compatibility

**Floating Point:**

```go
float32 // ~6 digits of precision
float64 // ~15 digits of precision (default)
```

```go
var pi float64 = 3.14159265359
var small float32 = 3.14  // Less precise
```

**Complex Numbers:**

```go
var c complex64 = 1 + 2i
var c2 complex128 = 1 + 2i
```

### Strings

Strings in Go are **immutable** sequences of bytes (UTF-8 by default):

```go
var name string = "Hello"
var empty string = ""
var multiline string = `This is a
multi-line
string`
```

**Key operations:**

```go
s := "Hello, World!"

len(s)              // 13 - byte length
s[0]                // 72 - first byte (not character!)
s[0:5]              // "Hello" - slicing
s + ", " + "Go"     // "Hello, World!" - concatenation
```

### Booleans

```go
var active bool = true
var isComplete bool = false
```

---

## Zero Values: The Foundation

One of Go's beautiful simplicities: **every variable is always initialized**. There's no "undefined" or "null" confusion for basic types.

| Type           | Zero Value | Meaning            |
| -------------- | ---------- | ------------------ |
| `int`, `float` | `0`        | Numeric zero       |
| `bool`         | `false`    | False              |
| `string`       | `""`       | Empty string       |
| `pointer`      | `nil`      | No reference       |
| `interface`    | `nil`      | No value           |
| `slice`        | `nil`      | No array           |
| `map`          | `nil`      | No key-value pairs |
| `channel`      | `nil`      | Uninitialized      |

**Why this matters:**

```go
var i int        // i is 0
var s string     // s is ""
var b bool       // b is false
var p *int       // p is nil

// No null pointer exceptions from uninitialized variables!
fmt.Println(i, s, b, p)  // 0 false <nil>
```

---

## Constants

Constants are values that **cannot change** during program execution:

```go
const Pi = 3.14159
const StatusOK = 200
const AppName = "MyApp"
```

**Rules:**

- Must be computable at compile time
- Cannot use runtime values:

```go
// Valid
const c = 1 / 3

// INVALID - runtime only
const c = time.Now()  // Compile error!
```

### The Power of `iota`

`iota` creates auto-incrementing constants—perfect for related values:

```go
const (
    Red    = iota  // 0
    Green          // 1
    Blue           // 2
)
```

**Practical example - HTTP status codes:**

```go
const (
    StatusContinue           = 100
    StatusOK                 = 200
    StatusCreated            = 201
    StatusBadRequest         = 400
    StatusNotFound           = 404
    StatusInternalServerError = 500
)

// With iota - cleaner!
const (
    StatusContinue           = iota + 100  // 100
    StatusOK                               // 101
    StatusCreated                          // 102
)
```

**Bit flags with iota:**

```go
const (
    Read  = 1 << iota  // 1
    Write               // 2
    Execute            // 4
)
```

---

## Type Conversion: Explicit is Better

Go **never implicitly converts types**. This prevents subtle bugs:

```go
var i int = 42
var f float64 = float64(i)  // MUST convert explicitly

// NOT valid:
// var f float64 = i  // Compile error!
```

**Common conversions:**

```go
// Number to string
str := strconv.Itoa(42)

// String to number
num, err := strconv.Atoi("42")

// Float formatting
s := fmt.Sprintf("%.2f", 3.14159)

// String to bytes and back
b := []byte("hello")
s := string(b)
```

**Precision loss:**

```go
var f float64 = 3.9
var i int = int(f)  // 3 - truncates, doesn't round!
```

---

## Best Practices

### 1. Use `:=` for Local Variables

```go
func main() {
    name := "Alice"   // Preferred inside functions
    age := 30

    // NOT:
    // var name string = "Alice"
    // var age int = 30
}
```

### 2. Use `var` for Package-Level

```go
package main

var (
    appName = "MyApp"
    version = "1.0.0"
)
```

### 3. Group Related Variables

```go
var (
    name  string
    age   int
    email string
)
```

### 4. Use Meaningful Names

```go
// Bad
var x int
var d float64

// Good
var userCount int
var averagePrice float64
```

---

## Common Errors and Fixes

### Error: "cannot use type on left"

```go
// INVALID
var i int
i := 10

// FIX: Choose one or the other
var i int = 10
// OR
i := 10
```

### Error: "mismatched types"

```go
var s string = 42  // ERROR

// FIX: Convert
var s string = strconv.Itoa(42)
// OR
var s string = fmt.Sprintf("%d", 42)
```

### Error: "assignment mismatch"

```go
var a, b int = 1
// FIX: match count
var a, b int = 1, 2
// OR
a, b := 1, 2
```

---

## Key Takeaways

1. **Three ways to declare:** `var`, type inference, and `:=`
2. **`:=` is idiomatic** inside functions
3. **Zero values** exist for every type—no undefined!
4. **Explicit conversion required** between types
5. **Constants** use `const`, auto-increment with `iota`
6. **Strings are immutable** byte slices

---

## Challenge

Try these in the playground:

1. Declare variables using all three methods
2. Observe zero values
3. Convert between types
4. Use `iota` to create a week constant

---

> **Pro Tip:** Use `go vet` in your build process—it catches type-related errors before runtime!

# Type Conversion

Go requires explicit type conversion between different types. This prevents subtle bugs.

---

## Why Explicit Conversion?

In Go, types are not automatically converted. This is a deliberate design choice:

```go
var i int = 42
var f float64 = i  // ERROR: cannot use i (int) as float64
```

This prevents runtime errors from unexpected type behavior.

---

## Converting Between Numbers

### Integer to Float

```go
var i int = 42
var f float64 = float64(i)  // float64() converts int to float64
```

### Float to Integer (Truncates!)

```go
var f float64 = 3.9
var i int = int(f)  // i = 3 (not 4!)
                    // int() truncates toward zero, doesn't round!
```

### Between Integer Sizes

```go
var i8 int8 = 100
var i32 int32 = int32(i8)  // int32() converts int8 to int32
var i64 int64 = int64(i32) // int64() converts int32 to int64
```

---

## Converting Strings

### String to Number

Use `strconv` package for string-to-number conversion:

```go
import "strconv"

// strconv.Atoi("string to int") - simplest way to convert string to int
// Returns (int, error) - always check the error!
num, err := strconv.Atoi("42")
if err != nil {
    fmt.Println("Failed:", err)
} else {
    fmt.Println(num) // prints 42
}

// strconv.ParseInt(string, base, bitSize) - more control
// base: 10 for decimal, bitSize: 8, 16, 32, 64
num64, err := strconv.ParseInt("42", 10, 64)

// strconv.ParseFloat(string, bitSize) - for decimal numbers
fl, err := strconv.ParseFloat("3.14", 64)
```

### Number to String

```go
import "strconv"

// strconv.Itoa(int to ASCII) - converts int to string
str := strconv.Itoa(42)
fmt.Println(str) // prints "42"

// strconv.FormatInt(value, base) - more control, takes int64
str64 := strconv.FormatInt(42, 10)

// strconv.FormatFloat(value, format, precision, bitSize)
// format: 'f' for fixed-point, 'e' for scientific
strFloat := strconv.FormatFloat(3.14, 'f', 2, 64)
fmt.Println(strFloat) // prints "3.14"
```

### Using Sprintf (Simple Cases)

For simple formatting without imports, use `fmt.Sprintf`:

```go
import "fmt"

// %d formats integer as decimal string
str := fmt.Sprintf("%d", 42)

// %.2f formats float with 2 decimal places
strFloat := fmt.Sprintf("%.2f", 3.14)
fmt.Println(strFloat) // prints "3.14"

// %v formats any value as string (useful for debugging)
strAny := fmt.Sprintf("%v", 42) // prints "42"
```

---

## Converting to/from Bytes

```go
str := "hello"

// []byte(str) converts string to byte slice
bytes := []byte(str)
fmt.Println(bytes) // prints [104 101 108 108 111]

// string(bytes) converts byte slice to string
str2 := string(bytes)
fmt.Println(str2) // prints "hello"
```

---

## Quick Reference Table

| Conversion      | Function                             | Example                |
| --------------- | ------------------------------------ | ---------------------- |
| int → float64   | `float64(i)`                         | `float64(42)` → `42.0` |
| float64 → int   | `int(f)`                             | `int(3.9)` → `3`       |
| string → int    | `strconv.Atoi(s)`                    | `"42"` → `42`          |
| int → string    | `strconv.Itoa(i)`                    | `42` → `"42"`          |
| string → float  | `strconv.ParseFloat(s, 64)`          | `"3.14"` → `3.14`      |
| float → string  | `strconv.FormatFloat(f, 'f', 2, 64)` | `3.14` → `"3.14"`      |
| string → []byte | `[]byte(s)`                          | `"hi"` → `[104 105]`   |
| []byte → string | `string(b)`                          | `[104 105]` → `"hi"`   |

---

## Best Practices

1. Always handle errors from `strconv` conversion functions - they return errors for invalid input
2. Use `strconv` for string conversions, not type casting
3. Be aware of precision loss when converting floats to integers (truncates, doesn't round!)
4. Use `fmt.Sprintf` for simple formatted conversions without extra imports

# Basic Types

Go provides several basic types that form the foundation of all data in the language.

---

## Integer Types

Go offers signed and unsigned integers in various sizes:

### Signed Integers (can be negative)

```go
int   // Platform dependent: 32 or 64 bits
int8  // -128 to 127
int16 // -32,768 to 32,767
int32 // -2,147,483,648 to 2,147,483,647
int64 // Very large range
```

### Unsigned Integers (positive only)

```go
uint  // Platform dependent
uint8 // 0 to 255
uint16 // 0 to 65,535
uint32 // 0 to 4,294,967,295
uint64 // Very large range
```

**When to use each:**

- Use `int` for most cases - it's the most efficient
- Use `uint` only when you need only positive values
- Use specific sizes for binary data or FFI

---

## Floating Point Types

```go
float32 // ~6 digits of precision
float64 // ~15 digits of precision (default)
```

```go
var pi float64 = 3.14159265359
var small float32 = 3.14
```

---

## Complex Numbers

```go
var c1 complex64 = 1 + 2i
var c2 complex128 = 1 + 2i

// Operations
fmt.Println(real(c2)) // 1
fmt.Println(imag(c2)) // 2
```

---

## Strings

```go
var name string = "Hello"
var empty string = ""
var multiline string = `This is a
multi-line
string`
```

**Key facts:**

- Immutable - cannot be changed after creation
- UTF-8 encoded by default
- Can contain any Unicode characters

---

## Booleans

```go
var isActive bool = true
var isComplete bool = false
```

---

## Zero Values Recap

| Type       | Zero Value |
| ---------- | ---------- |
| int, float | 0          |
| string     | ""         |
| bool       | false      |
| complex    | (0+0i)     |

---

## Best Practice

Always use `int` unless you have a specific reason to use another type. Go is designed to make the common case easy.

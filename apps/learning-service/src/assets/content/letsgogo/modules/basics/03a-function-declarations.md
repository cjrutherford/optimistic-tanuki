# Function Declarations

Functions are declared using the `func` keyword with a specific syntax in Go.

---

## Basic Syntax

```go
func functionName(parameterName parameterType) returnType {
    // function body
    return value
}
```

---

## Examples

### No Parameters, No Return

```go
func greet() {
    fmt.Println("Hello!")
}
```

### Single Parameter

```go
func greet(name string) {
    fmt.Println("Hello,", name)
}
```

### Multiple Parameters

```go
func add(a int, b int) int {
    return a + b
}

// Can simplify same type:
func add(a, b int) int {
    return a + b
}
```

### Multiple Parameters and Returns

```go
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}
```

---

## Parameter Naming

Parameters must have names (unlike return types which can be unnamed):

```go
// Valid
func foo(x int) int { return x }

// Invalid
func foo(int) int { return 0 }  // ERROR
```

---

## Best Practices

1. Use descriptive parameter names
2. Group same-type parameters together
3. Keep functions small and focused
4. Use multiple returns for error handling

---

## Challenge

Write a function that takes a first name and last name, and returns a full name with proper formatting.

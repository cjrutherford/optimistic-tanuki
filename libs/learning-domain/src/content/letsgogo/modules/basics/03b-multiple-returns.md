# Multiple Return Values

One of Go's most powerful features is returning multiple values from a function.

---

## Why Multiple Returns?

In Go, functions can return multiple values. This is commonly used for:

1. **Error handling** - return result and error
2. **Swapping values** - no need for temp variables
3. **Iterator patterns** - return value and done flag

---

## Basic Example

```go
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

func main() {
    result, err := divide(10, 2)
    if err != nil {
        fmt.Println("Error:", err)
    } else {
        fmt.Println("Result:", result)
    }
}
```

---

## Ignoring Return Values

You can ignore return values using `_`:

```go
result, _ := divide(10, 2)  // Ignore error
```

**Warning:** Be careful ignoring errors!

---

## Named Return Values

Go supports named return values:

```go
func split(sum int) (x, y int) {
    x = sum * 4 / 9
    y = sum - x
    return  // "naked" return
}
```

**Caution:** Use sparingly. Named returns can make code harder to read.

---

## Practical Pattern: OK Idiom

```go
func getValue(m map[string]int, key string) (int, bool) {
    val, ok := m[key]
    return val, ok
}

func main() {
    m := map[string]int{"a": 1, "b": 2}

    if val, ok := getValue(m, "a"); ok {
        fmt.Println("Found:", val)
    }
}
```

---

## Best Practices

1. Return errors as the last value
2. Use `nil` for error when no error occurred
3. Don't overuse named returns
4. Always handle errors, even if just logging

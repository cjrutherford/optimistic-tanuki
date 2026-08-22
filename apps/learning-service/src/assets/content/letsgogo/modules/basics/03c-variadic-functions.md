# Variadic Functions

Variadic functions can accept any number of arguments.

---

## Syntax

Use `...` before the type to make a parameter variadic:

```go
func sum(nums ...int) int {
    total := 0
    for _, n := range nums {
        total += n
    }
    return total
}
```

---

## Usage

```go
func main() {
    fmt.Println(sum(1, 2, 3))           // 6
    fmt.Println(sum(1, 2, 3, 4, 5))    // 15
    fmt.Println(sum())                   // 0
}
```

---

## Passing Slices

You can pass a slice to a variadic function using `...`:

```go
nums := []int{1, 2, 3, 4}
fmt.Println(sum(nums...))  // 10
```

---

## Multiple Parameters with Variadic

```go
func greet(prefix string, names ...string) string {
    if len(names) == 0 {
        return prefix + ", World!"
    }
    return prefix + ", " + strings.Join(names, ", ")
}

func main() {
    fmt.Println(greet("Hello"))                      // Hello, World!
    fmt.Println(greet("Hello", "Alice", "Bob"))    // Hello, Alice, Bob
}
```

---

## Common Use Cases

### String Formatting

```go
func printAll(prefix string, items ...string) {
    for _, item := range items {
        fmt.Println(prefix, item)
    }
}
```

### Finding Maximum

```go
func max(nums ...int) int {
    if len(nums) == 0 {
        return 0
    }
    result := nums[0]
    for _, n := range nums[1:] {
        if n > result {
            result = n
        }
    }
    return result
}
```

---

## Best Practices

1. Put variadic parameter last
2. Use it when number of arguments is unknown
3. Remember it's converted to a slice inside the function

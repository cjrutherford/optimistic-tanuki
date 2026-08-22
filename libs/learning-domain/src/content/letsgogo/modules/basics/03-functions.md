# Functions

Functions are the **building blocks** of Go programs. They encapsulate logic, promote code reuse, and make your code modular and testable.

---

## Function Declaration

### Basic Syntax

```go
func functionName(parameterName parameterType) returnType {
    // function body
    return value
}
```

### Complete Example

```go
func greet(name string) {
    fmt.Println("Hello,", name)
}

func main() {
    greet("Alice")  // Hello, Alice
}
```

---

## Deep Dive: Return Values

### Single Return Value

```go
func add(a int, b int) int {
    return a + b
}

func main() {
    result := add(1, 2)  // result = 3
    fmt.Println(result)
}
```

**Note:** Go supports **type grouping** for multiple parameters of the same type:

```go
// Both valid
func add(a int, b int) int
func add(a, b int) int
```

---

### Multiple Return Values: Go's Signature Feature

One of Go's most powerful features is **multiple return values**:

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
        fmt.Println("Result:", result)  // 5
    }

    // Handle edge case
    result, err = divide(10, 0)
    if err != nil {
        fmt.Println("Caught:", err)  // Caught: division by zero
    }
}
```

**Why is this important?**

This pattern is **idiomatic Go**—it's how Go handles errors. Instead of exceptions, functions return errors explicitly.

---

### Named Return Values

You can name your return parameters:

```go
func split(sum int) (x, y int) {
    x = sum * 4 / 9
    y = sum - x
    return  // Naked return - returns x and y
}
```

**Output:**

```
split(17) → x=7, y=10
```

> **⚠️ Caution:** Named returns can make code harder to read. Use sparingly. They shine when:
>
> - The return values need documentation
> - You're using "naked returns" for simple functions

---

## Variadic Functions

Go supports **variable arguments** with the `...` syntax:

```go
func sum(nums ...int) int {
    total := 0
    for _, n := range nums {
        total += n
    }
    return total
}

func main() {
    fmt.Println(sum(1, 2, 3))        // 6
    fmt.Println(sum(1, 2, 3, 4, 5))  // 15
    fmt.Println(sum())               // 0
}
```

**Practical example - string formatting:**

```go
func greet(prefix string, names ...string) string {
    if len(names) == 0 {
        return prefix + ", World!"
    }
    return prefix + ", " + strings.Join(names, ", ")
}

func main() {
    fmt.Println(greet("Hello"))                    // Hello, World!
    fmt.Println(greet("Hello", "Alice", "Bob"))   // Hello, Alice, Bob
}
```

---

## Anonymous Functions & Closures

### Anonymous Functions

Functions don't need names—these are called "function literals":

```go
func main() {
    // Assign to variable
    add := func(a, b int) int {
        return a + b
    }
    fmt.Println(add(1, 2))  // 3

    // Immediately invoked function expression (IIFE)
    result := func(x int) int {
        return x * 2
    }(5)
    fmt.Println(result)  // 10
}
```

### Closures: Functions That Capture State

A closure is a function that **remembers** variables from its surrounding scope:

```go
func adder() func(int) int {
    sum := 0
    return func(x int) int {
        sum += x
        return sum
    }
}

func main() {
    pos := adder()
    fmt.Println(pos(1))  // 1  (sum = 0 + 1)
    fmt.Println(pos(2))  // 3  (sum = 1 + 2)
    fmt.Println(pos(3))  // 6  (sum = 3 + 3)

    // Each closure has its own state
    neg := adder()
    fmt.Println(neg(-1))  // -1
}
```

**Real-world use case - HTTP handler with state:**

```go
func newCounter() http.HandlerFunc {
    count := 0
    return func(w http.ResponseWriter, r *http.Request) {
        count++
        fmt.Fprintf(w, "Visit #%d", count)
    }
}
```

---

## Functions as Values

Functions can be **passed around** just like any other value:

### Passing Functions as Arguments

```go
func apply(n int, fn func(int) int) int {
    return fn(n)
}

func double(x int) int {
    return x * 2
}

func main() {
    result := apply(5, double)  // 10
    fmt.Println(result)
}
```

### Function Types

```go
// Define a function type
type Operation func(int, int) int

func add(a, b int) int {
    return a + b
}

func multiply(a, b int) int {
    return a * b
}

func calculate(a, b int, op Operation) int {
    return op(a, b)
}

func main() {
    fmt.Println(calculate(3, 4, add))       // 7
    fmt.Println(calculate(3, 4, multiply))   // 12
}
```

---

## Error Handling Patterns

### The Standard Pattern

```go
func readFile(filename string) ([]byte, error) {
    data, err := os.ReadFile(filename)
    if err != nil {
        return nil, fmt.Errorf("failed to read %s: %w", filename, err)
    }
    return data, nil
}

func main() {
    data, err := readFile("config.json")
    if err != nil {
        fmt.Fprintf(os.Stderr, "Error: %v\n", err)
        os.Exit(1)
    }
    // Use data...
}
```

### Ignoring Errors (Carefully!)

Sometimes you intentionally ignore errors:

```go
// Common pattern: ignore with _
result, _ := divide(10, 2)

// But be careful - don't silently ignore real errors!
// This is OK when you know the operation can't fail:
_, err := fmt.Println("This won't error")
_ = err  // Explicitly acknowledging we checked it
```

---

## Best Practices

### 1. Keep Functions Small and Focused

```go
// Good: Single responsibility
func calculateTotal(items []Item) float64 { ... }
func sendEmail(to, subject, body string) error { ... }

// Avoid: God functions that do everything
func doEverything() { ... }  // Too broad!
```

### 2. Use Multiple Returns for Errors

```go
// ✓ Idiomatic Go
func doSomething() error { ... }

// Avoid: Exceptions (not idiomatic)
// throw new Error()  // NOT how Go works!
```

### 3. Document Functions with Comments

```go
// Add returns the sum of two integers.
//
// This function performs simple arithmetic addition
// and handles both positive and negative numbers.
func Add(a, b int) int {
    return a + b
}
```

### 4. Use Named Returns for Clarity (When Appropriate)

```go
// Good: Documents what the function returns
func splitIntoPages(content string) (headers []string, body string) { ... }

// Avoid: Unnecessary complexity
func process(data []byte) (x []byte, y error, z bool) { ... }
```

---

## Common Errors and Fixes

### Error: "too many arguments"

```go
func greet(name string) {
    fmt.Println("Hello", name)
}

// greet("Alice", "Bob")  // ERROR

// FIX: Use variadic
func greet(names ...string) {
    for _, name := range names {
        fmt.Println("Hello", name)
    }
}
```

### Error: "cannot use function as value"

```go
func add(a, b int) int {
    return a + b
}

// fmt.Println(add)  // ERROR - can't print a function!

// FIX: Call the function
fmt.Println(add(1, 2))  // 3
```

---

## Key Takeaways

1. **Multiple return values** are idiomatic for error handling
2. **Variadic functions** use `...` for flexible arguments
3. **Closures** capture variables from their enclosing scope
4. **Functions are first-class** - can be passed as values
5. **Keep functions small** - do one thing well
6. **Use `return` explicitly** except with named returns

---

## Challenge

Try creating:

1. A function that returns multiple values (quotient and remainder)
2. A closure that maintains a running average
3. A variadic function that finds the maximum of any number of integers

---

> **Pro Tip:** Run `go test -cover` to see how much of your code your functions cover with tests!

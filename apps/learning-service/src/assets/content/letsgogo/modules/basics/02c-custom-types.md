# Custom Types

Go allows you to create your own types based on existing ones.

---

## Type Definition

Create a new type using the `type` keyword:

```go
type Age int
type Name string
type Score float64
```

This creates a completely new type that is distinct from the underlying type.

---

## Why Create Custom Types?

### 1. Type Safety

```go
type UserID int
type OrderID int

func getUser(id UserID) { ... }
func getOrder(id OrderID) { ... }

getUser(123)    // OK
getOrder(123)   // OK
// getUser(OrderID(123)) // Type error!
```

### 2. Semantic Meaning

```go
type Celsius float64
type Fahrenheit float64

func toFahrenheit(c Celsius) Fahrenheit {
    return Fahrenheit(c*9/5 + 32)
}
```

### 3. Adding Methods

```go
type Counter int

func (c Counter) Increment() Counter {
    return c + 1
}

func main() {
    var c Counter = 0
    c = c.Increment()
}
```

---

## Type Aliases (Go 1.9+)

For compatibility, you can create type aliases:

```go
type String = string  // Alias, not new type
```

This is useful for refactoring or when you want to add methods to an existing type.

---

## Methods on Custom Types

```go
type Rectangle struct {
    Width  float64
    Height float64
}

func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

func (r *Rectangle) Scale(factor float64) {
    r.Width *= factor
    r.Height *= factor
}
```

---

## Best Practices

1. Use custom types for domain-specific concepts
2. Don't overuse - simple types like `int` are often fine
3. Add methods when you need type-specific behavior
4. Consider type safety benefits vs. complexity

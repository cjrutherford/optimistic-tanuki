# If/Else Statements

Go's if/else statements are straightforward with some unique features.

---

## Basic Syntax

```go
if condition {
    // code
} else {
    // code
}
```

---

## Condition with Initialization

Go allows you to initialize variables in the if statement:

```go
if x := getValue(); x > 10 {
    fmt.Println("Big:", x)
} else {
    fmt.Println("Small:", x)
}
// x is not accessible here
```

This is idiomatic Go for error handling:

```go
if err := doSomething(); err != nil {
    return err
}
```

---

## Else If

```go
if x < 0 {
    fmt.Println("Negative")
} else if x == 0 {
    fmt.Println("Zero")
} else {
    fmt.Println("Positive")
}
```

---

## Comparison Operators

```go
==    equal
!=    not equal
<     less than
<=    less than or equal
>     greater than
>=    greater than or equal
```

---

## Boolean Shortcuts

```go
if isValid && hasPermission {
    // both must be true
}

if isValid || isAdmin {
    // either must be true
}
```

---

## No Ternary Operator

Go doesn't have a ternary operator:

```go
// INVALID
result := x > 10 ? "big" : "small"

// Use if/else instead
var result string
if x > 10 {
    result = "big"
} else {
    result = "small"
}
```

---

## Best Practices

1. Use initialization form for error handling
2. Keep conditions simple
3. Don't overuse else if - consider switch

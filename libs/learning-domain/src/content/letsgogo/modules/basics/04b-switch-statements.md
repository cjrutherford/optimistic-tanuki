# Switch Statements

Go's switch is more flexible than many languages.

---

## Basic Syntax

```go
switch day {
case 1:
    fmt.Println("Monday")
case 2:
    fmt.Println("Tuesday")
case 3:
    fmt.Println("Wednesday")
default:
    fmt.Println("Unknown")
}
```

---

## Multiple Values

```go
switch day {
case 1, 2, 3, 4, 5:
    fmt.Println("Weekday")
case 6, 7:
    fmt.Println("Weekend")
}
```

---

## Expression Switch

```go
switch {
case hour < 12:
    fmt.Println("Morning")
case hour < 17:
    fmt.Println("Afternoon")
default:
    fmt.Println("Evening")
}
```

---

## With Initialization

```go
switch result := doSomething(); result {
case "ok":
    fmt.Println("Success")
case "error":
    fmt.Println("Failed")
default:
    fmt.Println("Unknown:", result)
}
```

---

## Fallthrough (Rarely Used)

By default, Go doesn't fall through. Use `fallthrough` explicitly:

```go
switch x {
case 1:
    fmt.Println("One")
    fallthrough
case 2:
    fmt.Println("Two")
}
```

**Note:** This is rarely needed in practice.

---

## Type Switch

Used with interfaces:

```go
func getType(v interface{}) string {
    switch v.(type) {
    case int:
        return "integer"
    case string:
        return "string"
    case bool:
        return "boolean"
    default:
        return "unknown"
    }
}
```

---

## Best Practices

1. Prefer switch over many if/else
2. Use default for catch-all cases
3. No need for `break` (automatic)
4. Consider switch for error handling too

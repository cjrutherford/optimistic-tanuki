# Control Flow

Go has straightforward control flow with some unique twists.

## If Statement

```go
if x > 0 {
    fmt.Println("positive")
} else if x < 0 {
    fmt.Println("negative")
} else {
    fmt.Println("zero")
}
```

### Variable Declaration in If

You can declare variables directly in the condition:

```go
if x := 10; x > 5 {
    fmt.Println(x)  // x is only visible inside the if block
}
```

This is idiomatic Go for keeping code concise:

```go
if err := doSomething(); err != nil {
    return err
}
```

## For Loop

Go has only one loop keyword - `for` - but it's very flexible.

### Basic For

```go
for i := 0; i < 10; i++ {
    fmt.Println(i)
}
```

### While-Style Loop

Omit the init and post statements:

```go
n := 0
for n < 10 {
    fmt.Println(n)
    n++
}
```

### Infinite Loop

```go
for {
    // Runs forever
    // Use break or return to exit
}
```

### Range Loop

Iterate over slices, maps, and strings:

```go
fruits := []string{"apple", "banana", "cherry"}

for i, fruit := range fruits {
    fmt.Println(i, fruit)
}

// Index only
for i := range fruits {
    fmt.Println(i)
}

// Value only
for _, fruit := range fruits {
    fmt.Println(fruit)
}
```

### Iterating Over Maps

```go
ages := map[string]int{
    "Alice": 30,
    "Bob":   25,
}

for name, age := range ages {
    fmt.Println(name, age)
}
```

## Switch Statement

### Basic Switch

```go
day := "monday"

switch day {
case "monday", "tuesday", "wednesday", "thursday", "friday":
    fmt.Println("weekday")
case "saturday", "sunday":
    fmt.Println("weekend")
default:
    fmt.Println("invalid")
}
```

### Switch with Expressions

```go
score := 85

switch {
case score >= 90:
    fmt.Println("A")
case score >= 80:
    fmt.Println("B")
case score >= 70:
    fmt.Println("C")
default:
    fmt.Println("F")
}
```

### Fallthrough

By default, Go doesn't fall through. Use `fallthrough` to explicitly continue:

```go
switch x := 2; x {
case 1:
    fmt.Println("one")
    fallthrough
case 2:
    fmt.Println("two")
    fallthrough
case 3:
    fmt.Println("three")
}
// Output: two three
```

> **Note:** `fallthrough` is rarely needed - use separate cases instead.

## Control Keywords

### Break

```go
for i := 0; i < 10; i++ {
    if i == 5 {
        break  // Exit loop
    }
    fmt.Println(i)
}
```

### Continue

```go
for i := 0; i < 10; i++ {
    if i % 2 == 0 {
        continue  // Skip this iteration
    }
    fmt.Println(i)  // Prints only odd numbers
}
```

### Goto (Use Sparingly!)

```go
func example() {
    if false {
        goto done
    }
    fmt.Println("running")

done:
    fmt.Println("finished")
}
```

> **Warning:** `goto` can make code hard to follow. Use it only in specific cases like breaking nested loops.

## Best Practices

1. **Use early returns** to reduce nesting
2. **Prefer `range` over index loops** when you don't need the index
3. **Keep conditions simple** or use variable declarations in the condition
4. **Don't use `fallthrough`** - separate your cases

## Code Playground

Try different control flow patterns and see how they work!

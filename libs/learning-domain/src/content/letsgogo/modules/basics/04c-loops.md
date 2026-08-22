# Loops

Go has only one looping construct: `for`. It's versatile and powerful.

---

## Basic For Loop

```go
for i := 0; i < 10; i++ {
    fmt.Println(i)
}
```

---

## While-Style Loop

Omit the init and post statements:

```go
sum := 1
for sum < 100 {
    sum += sum
}
fmt.Println(sum)
```

---

## Infinite Loop

Omit all conditions (use with caution):

```go
for {
    // runs forever
    // break or return to exit
}
```

---

## Range

Use `range` to iterate over slices, maps, and strings:

```go
nums := []int{1, 2, 3}

for i, v := range nums {
    fmt.Println(i, v)  // index, value
}

// Skip index
for _, v := range nums {
    fmt.Println(v)
}

// Just index
for i := range nums {
    fmt.Println(i)
}
```

### Iterating Over Maps

```go
m := map[string]int{"a": 1, "b": 2}

for k, v := range m {
    fmt.Println(k, v)
}
```

---

## Controlling the Loop

```go
for i := 0; i < 10; i++ {
    if i % 2 == 0 {
        continue  // skip even numbers
    }
    fmt.Println(i)
}
```

---

## No Parens Needed

```go
// Valid
for i := 0; i < 10; i++ { }

// Invalid
for (i := 0; i < 10; i++) { }
```

---

## Best Practices

1. Use `range` for slices and maps
2. Prefer `for` over `while`
3. Use `continue` to skip iterations
4. Use `break` with labels for nested loops

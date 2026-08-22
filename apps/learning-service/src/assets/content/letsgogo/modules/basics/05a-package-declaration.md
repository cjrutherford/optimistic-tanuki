# Package Declaration

Every Go file must declare which package it belongs to.

---

## Package Declaration

```go
package main
```

Key points:

- First line of every source file
- All files in same directory must have same package
- `main` package creates executable

---

## Executable vs Library

### Executable

```go
package main

func main() {
    fmt.Println("Hello!")
}
```

### Library

```go
package mathutil

func Add(a, b int) int {
    return a + b
}
```

---

## Package Names

- Short, lowercase names preferred
- No underscores or mixed case
- Match folder name (usually)

```go
package utils      // good
package utils_pkg  // bad
package Utils      // bad
```

---

## Main Package

The `main` package tells the compiler to create an executable:

```
myapp/
  main.go    -> package main
  utils.go   -> package main (or utils)
```

---

## Best Practices

1. Use `main` for executables
2. Use descriptive names for libraries
3. Keep package names short
4. Match directory names

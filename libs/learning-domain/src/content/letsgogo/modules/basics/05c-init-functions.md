# Init Functions

The `init` function runs before `main` for setup.

---

## Basic Init

```go
package main

import "fmt"

func init() {
    fmt.Println("Init running first!")
}

func main() {
    fmt.Println("Main running second!")
}
```

---

## When to Use Init

### 1. Package Initialization

```go
package mathutil

var results map[int]int

func init() {
    results = make(map[int]int)
    // precompute some values
}
```

### 2. Configuration

```go
var config struct{}

func init() {
    // load configuration
}
```

---

## Multiple Init Functions

Multiple init functions in same file run in order:

```go
func init() {
    fmt.Println("First init")
}

func init() {
    fmt.Println("Second init")
}
```

---

## Init in Libraries

Libraries often use init for registration:

```go
package parser

import "encoding/json"

func init() {
    // register custom types
}
```

---

## Key Points

1. Runs automatically before `main`
2. No parameters, no return value
3. Can have multiple per file
4. Execution order: imports → init → main

---

## Best Practices

1. Use sparingly - can make testing hard
2. Use for package-level setup only
3. Consider lazy initialization instead
4. Don't rely on init order across packages

---

## Alternative: Lazy Initialization

```go
var config *Config

func GetConfig() *Config {
    if config == nil {
        config = loadConfig()
    }
    return config
}
```

This is often more testable than init.
